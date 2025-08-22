import { describe, expect, it, vi, beforeEach } from "vitest";

// Interfaces for type safety
interface ClarityResponse<T> {
  ok: boolean;
  value: T | number; // number for error codes
}

interface UserProfile {
  registeredAt: number;
  metadata: string;
  isVerified: boolean;
}

interface FamilyRelations {
  parents: string[];
  children: string[];
  siblings: string[];
}

interface RelationVerification {
  verifiedBy?: string;
  verifiedAt?: number;
}

interface AuditLog {
  action: string;
  timestamp: number;
  performer: string;
}

interface ContractState {
  users: Map<string, UserProfile>;
  familyRelations: Map<string, FamilyRelations>;
  relationVerifications: Map<string, RelationVerification>;
  userAuditLogs: Map<string, AuditLog[]>;
  userLogCounters: Map<string, number>;
  paused: boolean;
  admin: string;
}

// Mock contract implementation
class UserRegistryMock {
  private state: ContractState = {
    users: new Map(),
    familyRelations: new Map(),
    relationVerifications: new Map(),
    userAuditLogs: new Map(),
    userLogCounters: new Map(),
    paused: false,
    admin: "deployer",
  };

  private MAX_METADATA_LEN = 500;
  private MAX_CHILDREN = 10;
  private MAX_SIBLINGS = 10;
  private MAX_PARENTS = 2;
  private ERR_NOT_AUTHORIZED = 100;
  private ERR_ALREADY_REGISTERED = 101;
  private ERR_INVALID_RELATION = 102;
  private ERR_USER_NOT_FOUND = 103;
  private ERR_MAX_RELATIONS_EXCEEDED = 104;
  private ERR_INVALID_METADATA = 105;
  private ERR_PAUSED = 106;
  private ERR_NOT_ADMIN = 107;

  private currentBlockHeight = 100;

  private getBlockHeight(): number {
    return this.currentBlockHeight++;
  }

  private logAction(user: string, action: string, performer: string): void {
    const logs = this.state.userAuditLogs.get(user) || [];
    const counter = (this.state.userLogCounters.get(user) || 0) + 1;
    logs.push({
      action,
      timestamp: this.getBlockHeight(),
      performer,
    });
    this.state.userAuditLogs.set(user, logs);
    this.state.userLogCounters.set(user, counter);
  }

  registerUser(caller: string, metadata: string): ClarityResponse<boolean> {
    if (this.state.paused) {
      return { ok: false, value: this.ERR_PAUSED };
    }
    if (this.state.users.has(caller)) {
      return { ok: false, value: this.ERR_ALREADY_REGISTERED };
    }
    if (metadata.length > this.MAX_METADATA_LEN) {
      return { ok: false, value: this.ERR_INVALID_METADATA };
    }
    this.state.users.set(caller, {
      registeredAt: this.getBlockHeight(),
      metadata,
      isVerified: false,
    });
    this.state.familyRelations.set(caller, {
      parents: [],
      children: [],
      siblings: [],
    });
    this.state.userLogCounters.set(caller, 0);
    this.logAction(caller, "registered", caller);
    return { ok: true, value: true };
  }

  addParent(caller: string, parent: string): ClarityResponse<boolean> {
    if (this.state.paused) {
      return { ok: false, value: this.ERR_PAUSED };
    }
    if (!this.state.users.has(caller)) {
      return { ok: false, value: this.ERR_NOT_AUTHORIZED };
    }
    const relations = this.state.familyRelations.get(caller)!;
    if (relations.parents.length >= this.MAX_PARENTS) {
      return { ok: false, value: this.ERR_MAX_RELATIONS_EXCEEDED };
    }
    if (caller === parent) {
      return { ok: false, value: this.ERR_INVALID_RELATION };
    }
    relations.parents.push(parent);
    this.state.familyRelations.set(caller, relations);

    if (this.state.familyRelations.has(parent)) {
      const parentRelations = this.state.familyRelations.get(parent)!;
      if (!parentRelations.children.includes(caller)) {
        parentRelations.children.push(caller);
        this.state.familyRelations.set(parent, parentRelations);
      }
    }

    this.logAction(caller, "added-parent", parent);
    return { ok: true, value: true };
  }

  addChild(caller: string, child: string): ClarityResponse<boolean> {
    if (this.state.paused) {
      return { ok: false, value: this.ERR_PAUSED };
    }
    if (!this.state.users.has(caller)) {
      return { ok: false, value: this.ERR_NOT_AUTHORIZED };
    }
    const relations = this.state.familyRelations.get(caller)!;
    if (relations.children.length >= this.MAX_CHILDREN) {
      return { ok: false, value: this.ERR_MAX_RELATIONS_EXCEEDED };
    }
    if (caller === child) {
      return { ok: false, value: this.ERR_INVALID_RELATION };
    }
    relations.children.push(child);
    this.state.familyRelations.set(caller, relations);

    if (this.state.familyRelations.has(child)) {
      const childRelations = this.state.familyRelations.get(child)!;
      if (!childRelations.parents.includes(caller)) {
        childRelations.parents.push(caller);
        this.state.familyRelations.set(child, childRelations);
      }
    }

    this.logAction(caller, "added-child", child);
    return { ok: true, value: true };
  }

  addSibling(caller: string, sibling: string): ClarityResponse<boolean> {
    if (this.state.paused) {
      return { ok: false, value: this.ERR_PAUSED };
    }
    if (!this.state.users.has(caller)) {
      return { ok: false, value: this.ERR_NOT_AUTHORIZED };
    }
    const relations = this.state.familyRelations.get(caller)!;
    if (relations.siblings.length >= this.MAX_SIBLINGS) {
      return { ok: false, value: this.ERR_MAX_RELATIONS_EXCEEDED };
    }
    if (caller === sibling) {
      return { ok: false, value: this.ERR_INVALID_RELATION };
    }
    relations.siblings.push(sibling);
    this.state.familyRelations.set(caller, relations);

    if (this.state.familyRelations.has(sibling)) {
      const sibRelations = this.state.familyRelations.get(sibling)!;
      if (!sibRelations.siblings.includes(caller)) {
        sibRelations.siblings.push(caller);
        this.state.familyRelations.set(sibling, sibRelations);
      }
    }

    this.logAction(caller, "added-sibling", sibling);
    return { ok: true, value: true };
  }

  verifyRelation(caller: string, relative: string, relationType: string, verifier: string): ClarityResponse<boolean> {
    if (this.state.paused) {
      return { ok: false, value: this.ERR_PAUSED };
    }
    if (caller !== verifier) {
      return { ok: false, value: this.ERR_NOT_AUTHORIZED };
    }
    const key = `${caller}-${relative}-${relationType}`;
    this.state.relationVerifications.set(key, {
      verifiedBy: verifier,
      verifiedAt: this.getBlockHeight(),
    });
    this.logAction(caller, `verified-${relationType}`, relative);
    return { ok: true, value: true };
  }

  updateMetadata(caller: string, newMetadata: string): ClarityResponse<boolean> {
    if (this.state.paused) {
      return { ok: false, value: this.ERR_PAUSED };
    }
    if (!this.state.users.has(caller)) {
      return { ok: false, value: this.ERR_USER_NOT_FOUND };
    }
    if (newMetadata.length > this.MAX_METADATA_LEN) {
      return { ok: false, value: this.ERR_INVALID_METADATA };
    }
    const user = this.state.users.get(caller)!;
    this.state.users.set(caller, { ...user, metadata: newMetadata });
    this.logAction(caller, "updated-metadata", caller);
    return { ok: true, value: true };
  }

  setUserVerified(caller: string, user: string, verified: boolean): ClarityResponse<boolean> {
    if (caller !== this.state.admin) {
      return { ok: false, value: this.ERR_NOT_ADMIN };
    }
    const userProfile = this.state.users.get(user);
    if (!userProfile) {
      return { ok: false, value: this.ERR_USER_NOT_FOUND };
    }
    this.state.users.set(user, { ...userProfile, isVerified: verified });
    this.logAction(user, "set-verified", caller);
    return { ok: true, value: true };
  }

  pauseContract(caller: string): ClarityResponse<boolean> {
    if (caller !== this.state.admin) {
      return { ok: false, value: this.ERR_NOT_ADMIN };
    }
    this.state.paused = true;
    return { ok: true, value: true };
  }

  unpauseContract(caller: string): ClarityResponse<boolean> {
    if (caller !== this.state.admin) {
      return { ok: false, value: this.ERR_NOT_ADMIN };
    }
    this.state.paused = false;
    return { ok: true, value: true };
  }

  setAdmin(caller: string, newAdmin: string): ClarityResponse<boolean> {
    if (caller !== this.state.admin) {
      return { ok: false, value: this.ERR_NOT_ADMIN };
    }
    this.state.admin = newAdmin;
    return { ok: true, value: true };
  }

  getUserProfile(user: string): ClarityResponse<UserProfile | null> {
    return { ok: true, value: this.state.users.get(user) || null };
  }

  getFamilyRelations(user: string): ClarityResponse<FamilyRelations | null> {
    return { ok: true, value: this.state.familyRelations.get(user) || null };
  }

  getRelationVerification(user: string, relative: string, relationType: string): ClarityResponse<RelationVerification | null> {
    const key = `${user}-${relative}-${relationType}`;
    return { ok: true, value: this.state.relationVerifications.get(key) || null };
  }

  getUserAuditLog(user: string, logId: number): ClarityResponse<AuditLog | null> {
    const logs = this.state.userAuditLogs.get(user) || [];
    return { ok: true, value: logs[logId - 1] || null };
  }

  getUserLogCounter(user: string): ClarityResponse<number> {
    return { ok: true, value: this.state.userLogCounters.get(user) || 0 };
  }

  isUserRegistered(user: string): ClarityResponse<boolean> {
    return { ok: true, value: this.state.users.has(user) };
  }

  isContractPaused(): ClarityResponse<boolean> {
    return { ok: true, value: this.state.paused };
  }

  getAdmin(): ClarityResponse<string> {
    return { ok: true, value: this.state.admin };
  }
}

// Test setup
const accounts = {
  deployer: "deployer",
  user1: "wallet_1",
  user2: "wallet_2",
  user3: "wallet_3",
  unauthorized: "wallet_4",
};

describe("UserRegistry Contract", () => {
  let contract: UserRegistryMock;

  beforeEach(() => {
    contract = new UserRegistryMock();
    vi.resetAllMocks();
  });

  it("should allow user to register with valid metadata", () => {
    const metadata = JSON.stringify({ name: "John Doe", dob: "1990-01-01" });
    const result = contract.registerUser(accounts.user1, metadata);
    expect(result).toEqual({ ok: true, value: true });

    const profile = contract.getUserProfile(accounts.user1);
    expect(profile).toEqual({
      ok: true,
      value: expect.objectContaining({
        metadata,
        isVerified: false,
      }),
    });

    const relations = contract.getFamilyRelations(accounts.user1);
    expect(relations).toEqual({
      ok: true,
      value: { parents: [], children: [], siblings: [] },
    });

    const logCounter = contract.getUserLogCounter(accounts.user1);
    expect(logCounter).toEqual({ ok: true, value: 1 });

    const log = contract.getUserAuditLog(accounts.user1, 1);
    expect(log).toEqual({
      ok: true,
      value: expect.objectContaining({
        action: "registered",
        performer: accounts.user1,
      }),
    });
  });

  it("should prevent duplicate user registration", () => {
    contract.registerUser(accounts.user1, JSON.stringify({ name: "John" }));
    const result = contract.registerUser(accounts.user1, JSON.stringify({ name: "John" }));
    expect(result).toEqual({ ok: false, value: 101 });
  });

  it("should prevent registration with oversized metadata", () => {
    const longMetadata = "a".repeat(501);
    const result = contract.registerUser(accounts.user1, longMetadata);
    expect(result).toEqual({ ok: false, value: 105 });
  });

  it("should allow adding a parent and update reciprocal relations", () => {
    contract.registerUser(accounts.user1, JSON.stringify({ name: "Child" }));
    contract.registerUser(accounts.user2, JSON.stringify({ name: "Parent" }));

    const result = contract.addParent(accounts.user1, accounts.user2);
    expect(result).toEqual({ ok: true, value: true });

    const userRelations = contract.getFamilyRelations(accounts.user1);
    expect(userRelations).toEqual({
      ok: true,
      value: expect.objectContaining({
        parents: [accounts.user2],
      }),
    });

    const parentRelations = contract.getFamilyRelations(accounts.user2);
    expect(parentRelations).toEqual({
      ok: true,
      value: expect.objectContaining({
        children: [accounts.user1],
      }),
    });

    const log = contract.getUserAuditLog(accounts.user1, 2);
    expect(log).toEqual({
      ok: true,
      value: expect.objectContaining({
        action: "added-parent",
        performer: accounts.user2,
      }),
    });
  });

  it("should prevent adding self as parent", () => {
    contract.registerUser(accounts.user1, JSON.stringify({ name: "User" }));
    const result = contract.addParent(accounts.user1, accounts.user1);
    expect(result).toEqual({ ok: false, value: 102 });
  });

  it("should prevent adding parent when max parents reached", () => {
    contract.registerUser(accounts.user1, JSON.stringify({ name: "Child" }));
    contract.registerUser(accounts.user2, JSON.stringify({ name: "Parent1" }));
    contract.registerUser(accounts.user3, JSON.stringify({ name: "Parent2" }));

    contract.addParent(accounts.user1, accounts.user2);
    contract.addParent(accounts.user1, accounts.user3);
    const result = contract.addParent(accounts.user1, accounts.unauthorized);
    expect(result).toEqual({ ok: false, value: 104 });
  });

  it("should allow adding a child and update reciprocal relations", () => {
    contract.registerUser(accounts.user1, JSON.stringify({ name: "Parent" }));
    contract.registerUser(accounts.user2, JSON.stringify({ name: "Child" }));

    const result = contract.addChild(accounts.user1, accounts.user2);
    expect(result).toEqual({ ok: true, value: true });

    const parentRelations = contract.getFamilyRelations(accounts.user1);
    expect(parentRelations).toEqual({
      ok: true,
      value: expect.objectContaining({
        children: [accounts.user2],
      }),
    });

    const childRelations = contract.getFamilyRelations(accounts.user2);
    expect(childRelations).toEqual({
      ok: true,
      value: expect.objectContaining({
        parents: [accounts.user1],
      }),
    });

    const log = contract.getUserAuditLog(accounts.user1, 2);
    expect(log).toEqual({
      ok: true,
      value: expect.objectContaining({
        action: "added-child",
        performer: accounts.user2,
      }),
    });
  });

  it("should prevent adding child when max children reached", () => {
    contract.registerUser(accounts.user1, JSON.stringify({ name: "Parent" }));
    for (let i = 0; i < 10; i++) {
      contract.registerUser(`wallet_${i + 5}`, JSON.stringify({ name: `Child${i}` }));
      contract.addChild(accounts.user1, `wallet_${i + 5}`);
    }
    const result = contract.addChild(accounts.user1, accounts.user2);
    expect(result).toEqual({ ok: false, value: 104 });
  });

  it("should allow adding a sibling and update reciprocal relations", () => {
    contract.registerUser(accounts.user1, JSON.stringify({ name: "Sibling1" }));
    contract.registerUser(accounts.user2, JSON.stringify({ name: "Sibling2" }));

    const result = contract.addSibling(accounts.user1, accounts.user2);
    expect(result).toEqual({ ok: true, value: true });

    const user1Relations = contract.getFamilyRelations(accounts.user1);
    expect(user1Relations).toEqual({
      ok: true,
      value: expect.objectContaining({
        siblings: [accounts.user2],
      }),
    });

    const user2Relations = contract.getFamilyRelations(accounts.user2);
    expect(user2Relations).toEqual({
      ok: true,
      value: expect.objectContaining({
        siblings: [accounts.user1],
      }),
    });

    const log = contract.getUserAuditLog(accounts.user1, 2);
    expect(log).toEqual({
      ok: true,
      value: expect.objectContaining({
        action: "added-sibling",
        performer: accounts.user2,
      }),
    });
  });

  it("should prevent adding sibling when max siblings reached", () => {
    contract.registerUser(accounts.user1, JSON.stringify({ name: "Sibling1" }));
    for (let i = 0; i < 10; i++) {
      contract.registerUser(`wallet_${i + 5}`, JSON.stringify({ name: `Sibling${i}` }));
      contract.addSibling(accounts.user1, `wallet_${i + 5}`);
    }
    const result = contract.addSibling(accounts.user1, accounts.user2);
    expect(result).toEqual({ ok: false, value: 104 });
  });

  it("should allow verifying a relation", () => {
    contract.registerUser(accounts.user1, JSON.stringify({ name: "User" }));
    contract.registerUser(accounts.user2, JSON.stringify({ name: "Parent" }));
    contract.addParent(accounts.user1, accounts.user2);

    const result = contract.verifyRelation(accounts.user1, accounts.user2, "parent", accounts.user1);
    expect(result).toEqual({ ok: true, value: true });

    const verification = contract.getRelationVerification(accounts.user1, accounts.user2, "parent");
    expect(verification).toEqual({
      ok: true,
      value: expect.objectContaining({
        verifiedBy: accounts.user1,
      }),
    });

    const log = contract.getUserAuditLog(accounts.user1, 3);
    expect(log).toEqual({
      ok: true,
      value: expect.objectContaining({
        action: "verified-parent",
        performer: accounts.user2,
      }),
    });
  });

  it("should prevent unauthorized relation verification", () => {
    contract.registerUser(accounts.user1, JSON.stringify({ name: "User" }));
    const result = contract.verifyRelation(accounts.user1, accounts.user2, "parent", accounts.unauthorized);
    expect(result).toEqual({ ok: false, value: 100 });
  });

  it("should allow updating metadata", () => {
    contract.registerUser(accounts.user1, JSON.stringify({ name: "John" }));
    const newMetadata = JSON.stringify({ name: "John Doe", dob: "1990-01-01" });
    const result = contract.updateMetadata(accounts.user1, newMetadata);
    expect(result).toEqual({ ok: true, value: true });

    const profile = contract.getUserProfile(accounts.user1);
    expect(profile).toEqual({
      ok: true,
      value: expect.objectContaining({
        metadata: newMetadata,
      }),
    });

    const log = contract.getUserAuditLog(accounts.user1, 2);
    expect(log).toEqual({
      ok: true,
      value: expect.objectContaining({
        action: "updated-metadata",
        performer: accounts.user1,
      }),
    });
  });

  it("should prevent updating metadata for non-registered user", () => {
    const result = contract.updateMetadata(accounts.user1, JSON.stringify({ name: "John" }));
    expect(result).toEqual({ ok: false, value: 103 });
  });

  it("should allow admin to set user verification status", () => {
    contract.registerUser(accounts.user1, JSON.stringify({ name: "John" }));
    const result = contract.setUserVerified(accounts.deployer, accounts.user1, true);
    expect(result).toEqual({ ok: true, value: true });

    const profile = contract.getUserProfile(accounts.user1);
    expect(profile).toEqual({
      ok: true,
      value: expect.objectContaining({
        isVerified: true,
      }),
    });

    const log = contract.getUserAuditLog(accounts.user1, 2);
    expect(log).toEqual({
      ok: true,
      value: expect.objectContaining({
        action: "set-verified",
        performer: accounts.deployer,
      }),
    });
  });

  it("should prevent non-admin from setting verification status", () => {
    contract.registerUser(accounts.user1, JSON.stringify({ name: "John" }));
    const result = contract.setUserVerified(accounts.user2, accounts.user1, true);
    expect(result).toEqual({ ok: false, value: 107 });
  });

  it("should allow admin to pause and unpause contract", () => {
    let result = contract.pauseContract(accounts.deployer);
    expect(result).toEqual({ ok: true, value: true });
    expect(contract.isContractPaused()).toEqual({ ok: true, value: true });

    const registerDuringPause = contract.registerUser(accounts.user1, JSON.stringify({ name: "John" }));
    expect(registerDuringPause).toEqual({ ok: false, value: 106 });

    result = contract.unpauseContract(accounts.deployer);
    expect(result).toEqual({ ok: true, value: true });
    expect(contract.isContractPaused()).toEqual({ ok: true, value: false });

    const registerAfterUnpause = contract.registerUser(accounts.user1, JSON.stringify({ name: "John" }));
    expect(registerAfterUnpause).toEqual({ ok: true, value: true });
  });

  it("should prevent non-admin from pausing contract", () => {
    const result = contract.pauseContract(accounts.user1);
    expect(result).toEqual({ ok: false, value: 107 });
  });

  it("should allow admin to change admin", () => {
    const result = contract.setAdmin(accounts.deployer, accounts.user1);
    expect(result).toEqual({ ok: true, value: true });
    expect(contract.getAdmin()).toEqual({ ok: true, value: accounts.user1 });
  });

  it("should prevent non-admin from changing admin", () => {
    const result = contract.setAdmin(accounts.user1, accounts.user2);
    expect(result).toEqual({ ok: false, value: 107 });
  });
});