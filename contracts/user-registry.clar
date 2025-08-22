;; UserRegistry Smart Contract
;; This contract manages user registrations and family tree structures for the Family Health Tree Builder.
;; It allows users to register profiles, link family members (parents, children, siblings), update relations,
;; verify family connections, and handle user metadata securely. It's the foundational contract for building
;; the family health tree, ensuring immutable and verifiable relationships.

;; Constants
(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-ALREADY-REGISTERED u101)
(define-constant ERR-INVALID-RELATION u102)
(define-constant ERR-USER-NOT-FOUND u103)
(define-constant ERR-MAX-RELATIONS-EXCEEDED u104)
(define-constant ERR-INVALID-METADATA u105)
(define-constant ERR-PAUSED u106)
(define-constant ERR-NOT-ADMIN u107)
(define-constant MAX-CHILDREN u10)
(define-constant MAX-SIBLINGS u10)
(define-constant MAX-METADATA-LEN u500)
(define-constant CONTRACT-OWNER tx-sender)

;; Data Variables
(define-data-var contract-paused bool false)
(define-data-var admin principal CONTRACT-OWNER)

;; Data Maps
(define-map users
  { user: principal }
  {
    registered-at: uint,
    metadata: (string-utf8 500),  ;; User profile metadata (e.g., name, DOB in JSON-like string)
    is-verified: bool
  }
)

(define-map family-relations
  { user: principal }
  {
    parents: (list 2 principal),  ;; Up to 2 parents
    children: (list 10 principal),
    siblings: (list 10 principal)
  }
)

(define-map relation-verifications
  { user: principal, relative: principal, relation-type: (string-ascii 10) }
  {
    verified-by: (optional principal),
    verified-at: (optional uint)
  }
)

(define-map user-audit-log
  { user: principal, log-id: uint }
  {
    action: (string-ascii 50),
    timestamp: uint,
    performer: principal
  }
)

(define-map user-log-counter
  { user: principal }
  { counter: uint }
)

;; Public Functions

(define-public (register-user (metadata (string-utf8 500)))
  (let
    (
      (caller tx-sender)
      (existing-user (map-get? users { user: caller }))
    )
    (if (var-get contract-paused)
      (err ERR-PAUSED)
      (if (is-some existing-user)
        (err ERR-ALREADY-REGISTERED)
        (begin
          (if (> (len metadata) MAX-METADATA-LEN)
            (err ERR-INVALID-METADATA)
            (begin
              (map-set users
                { user: caller }
                {
                  registered-at: block-height,
                  metadata: metadata,
                  is-verified: false
                }
              )
              (map-set family-relations
                { user: caller }
                {
                  parents: (list),
                  children: (list),
                  siblings: (list)
                }
              )
              (map-set user-log-counter { user: caller } { counter: u0 })
              (log-action caller "registered" caller)
              (ok true)
            )
          )
        )
      )
    )
  )
)

(define-public (add-parent (parent principal))
  (let
    (
      (caller tx-sender)
      (user-relations (unwrap! (map-get? family-relations { user: caller }) (err ERR-USER-NOT-FOUND)))
      (current-parents (get parents user-relations))
    )
    (if (var-get contract-paused)
      (err ERR-PAUSED)
      (if (is-user-registered caller)
        (if (>= (len current-parents) u2)
          (err ERR-MAX-RELATIONS-EXCEEDED)
          (if (is-eq caller parent)
            (err ERR-INVALID-RELATION)
            (begin
              (map-set family-relations
                { user: caller }
                (merge user-relations { parents: (unwrap! (as-max-len? (append current-parents parent) u2) (err ERR-MAX-RELATIONS-EXCEEDED)) })
              )
              ;; Reciprocally add child to parent's children if parent is registered
              (match (map-get? family-relations { user: parent })
                parent-relations
                (let ((parent-children (get children parent-relations)))
                  (if (not (is-some (index-of? parent-children caller)))
                    (map-set family-relations
                      { user: parent }
                      (merge parent-relations { children: (unwrap! (as-max-len? (append parent-children caller) MAX-CHILDREN) (err ERR-MAX-RELATIONS-EXCEEDED)) })
                    )
                    true
                  )
                )
                true
              )
              (log-action caller "added-parent" parent)
              (ok true)
            )
          )
        )
        (err ERR-NOT-AUTHORIZED)
      )
    )
  )
)

(define-public (add-child (child principal))
  (let
    (
      (caller tx-sender)
      (user-relations (unwrap! (map-get? family-relations { user: caller }) (err ERR-USER-NOT-FOUND)))
      (current-children (get children user-relations))
    )
    (if (var-get contract-paused)
      (err ERR-PAUSED)
      (if (is-user-registered caller)
        (if (>= (len current-children) MAX-CHILDREN)
          (err ERR-MAX-RELATIONS-EXCEEDED)
          (if (is-eq caller child)
            (err ERR-INVALID-RELATION)
            (begin
              (map-set family-relations
                { user: caller }
                (merge user-relations { children: (unwrap! (as-max-len? (append current-children child) MAX-CHILDREN) (err ERR-MAX-RELATIONS-EXCEEDED)) })
              )
              ;; Reciprocally add parent to child's parents if child is registered
              (match (map-get? family-relations { user: child })
                child-relations
                (let ((child-parents (get parents child-relations)))
                  (if (not (is-some (index-of? child-parents caller)))
                    (map-set family-relations
                      { user: child }
                      (merge child-relations { parents: (unwrap! (as-max-len? (append child-parents caller) u2) (err ERR-MAX-RELATIONS-EXCEEDED)) })
                    )
                    true
                  )
                )
                true
              )
              (log-action caller "added-child" child)
              (ok true)
            )
          )
        )
        (err ERR-NOT-AUTHORIZED)
      )
    )
  )
)

(define-public (add-sibling (sibling principal))
  (let
    (
      (caller tx-sender)
      (user-relations (unwrap! (map-get? family-relations { user: caller }) (err ERR-USER-NOT-FOUND)))
      (current-siblings (get siblings user-relations))
    )
    (if (var-get contract-paused)
      (err ERR-PAUSED)
      (if (is-user-registered caller)
        (if (>= (len current-siblings) MAX-SIBLINGS)
          (err ERR-MAX-RELATIONS-EXCEEDED)
          (if (is-eq caller sibling)
            (err ERR-INVALID-RELATION)
            (begin
              (map-set family-relations
                { user: caller }
                (merge user-relations { siblings: (unwrap! (as-max-len? (append current-siblings sibling) MAX-SIBLINGS) (err ERR-MAX-RELATIONS-EXCEEDED)) })
              )
              ;; Reciprocally add sibling if registered
              (match (map-get? family-relations { user: sibling })
                sib-relations
                (let ((sib-siblings (get siblings sib-relations)))
                  (if (not (is-some (index-of? sib-siblings caller)))
                    (map-set family-relations
                      { user: sibling }
                      (merge sib-relations { siblings: (unwrap! (as-max-len? (append sib-siblings caller) MAX-SIBLINGS) (err ERR-MAX-RELATIONS-EXCEEDED)) })
                    )
                    true
                  )
                )
                true
              )
              (log-action caller "added-sibling" sibling)
              (ok true)
            )
          )
        )
        (err ERR-NOT-AUTHORIZED)
      )
    )
  )
)

(define-public (verify-relation (relative principal) (relation-type (string-ascii 10)) (verifier principal))
  (let
    (
      (caller tx-sender)
    )
    (if (var-get contract-paused)
      (err ERR-PAUSED)
      (if (is-eq caller verifier)  ;; Verifier must be the caller or authorized, but for simplicity, caller verifies
        (begin
          (map-set relation-verifications
            { user: caller, relative: relative, relation-type: relation-type }
            {
              verified-by: (some verifier),
              verified-at: (some block-height)
            }
          )
          (log-action caller (concat "verified-" relation-type) relative)
          (ok true)
        )
        (err ERR-NOT-AUTHORIZED)
      )
    )
  )
)

(define-public (update-metadata (new-metadata (string-utf8 500)))
  (let
    (
      (caller tx-sender)
      (existing-user (unwrap! (map-get? users { user: caller }) (err ERR-USER-NOT-FOUND)))
    )
    (if (var-get contract-paused)
      (err ERR-PAUSED)
      (if (> (len new-metadata) MAX-METADATA-LEN)
        (err ERR-INVALID-METADATA)
        (begin
          (map-set users
            { user: caller }
            (merge existing-user { metadata: new-metadata })
          )
          (log-action caller "updated-metadata" caller)
          (ok true)
        )
      )
    )
  )
)

(define-public (set-user-verified (user principal) (verified bool))
  (let
    (
      (caller tx-sender)
      (existing-user (unwrap! (map-get? users { user: user }) (err ERR-USER-NOT-FOUND)))
    )
    (if (is-eq caller (var-get admin))
      (begin
        (map-set users
          { user: user }
          (merge existing-user { is-verified: verified })
        )
        (log-action user "set-verified" caller)
        (ok true)
      )
      (err ERR-NOT-ADMIN)
    )
  )
)

(define-public (pause-contract)
  (if (is-eq tx-sender (var-get admin))
    (begin
      (var-set contract-paused true)
      (ok true)
    )
    (err ERR-NOT-ADMIN)
  )
)

(define-public (unpause-contract)
  (if (is-eq tx-sender (var-get admin))
    (begin
      (var-set contract-paused false)
      (ok true)
    )
    (err ERR-NOT-ADMIN)
  )
)

(define-public (set-admin (new-admin principal))
  (if (is-eq tx-sender (var-get admin))
    (begin
      (var-set admin new-admin)
      (ok true)
    )
    (err ERR-NOT-ADMIN)
  )
)

;; Read-Only Functions

(define-read-only (get-user-profile (user principal))
  (map-get? users { user: user })
)

(define-read-only (get-family-relations (user principal))
  (map-get? family-relations { user: user })
)

(define-read-only (get-relation-verification (user principal) (relative principal) (relation-type (string-ascii 10)))
  (map-get? relation-verifications { user: user, relative: relative, relation-type: relation-type })
)

(define-read-only (get-user-audit-log (user principal) (log-id uint))
  (map-get? user-audit-log { user: user, log-id: log-id })
)

(define-read-only (get-user-log-counter (user principal))
  (default-to u0 (get counter (map-get? user-log-counter { user: user })))
)

(define-read-only (is-user-registered (user principal))
  (is-some (map-get? users { user: user }))
)

(define-read-only (is-contract-paused)
  (var-get contract-paused)
)

(define-read-only (get-admin)
  (var-get admin)
)

;; Private Functions

(define-private (log-action (user principal) (action (string-ascii 50)) (performer principal))
  (let
    (
      (current-counter (get-user-log-counter user))
      (new-counter (+ current-counter u1))
    )
    (map-set user-audit-log
      { user: user, log-id: new-counter }
      {
        action: action,
        timestamp: block-height,
        performer: performer
      }
    )
    (map-set user-log-counter { user: user } { counter: new-counter })
    true
  )
)