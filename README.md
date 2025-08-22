# 🌳 Blockchain-based Family Health Tree Builder

Welcome to a secure and decentralized way to manage your family's medical history on the Stacks blockchain! This project enables users to build an immutable family health tree, store sensitive medical data, control access, and verify authenticity, ensuring privacy and trust in generational health records.

## ✨ Features

🔒 **Secure Data Storage**: Store encrypted medical records with unique hashes on the blockchain.  
👨‍👩‍👧 **Family Tree Structure**: Link family members to create an inheritable health tree.  
🔐 **Granular Access Control**: Grant or revoke access to specific family members or healthcare providers.  
✅ **Data Verification**: Verify the authenticity and ownership of medical records instantly.  
📜 **Immutable History**: Track all updates to medical records with timestamps and audit trails.  
🔄 **Inheritance Mechanism**: Pass medical data access to descendants securely.  
🚫 **Duplicate Prevention**: Ensure no duplicate or fraudulent records are added.

## 🛠 How It Works

**For Families**  
- Register as a user and create a family tree node (your profile).  
- Add medical records with a unique hash, title, and description.  
- Link family members (parents, children, siblings) to build the tree.  
- Use access control to share specific records with family or doctors.  
- Inherit access rights to descendants via smart contracts.  

**For Healthcare Providers**  
- Request access to a patient’s family health tree with their permission.  
- Verify the authenticity of medical records using the blockchain.  
- View immutable audit trails to ensure data integrity.  

**For Verifiers**  
- Use public functions to check ownership and timestamp of medical records.  
- Confirm no tampering or duplication in the family health tree.

## 📜 Smart Contracts

This project uses **7 Clarity smart contracts** to manage the family health tree and medical data securely:

1. **UserRegistry**: Registers users and their family tree nodes (e.g., parent-child relationships).  
2. **MedicalRecord**: Stores encrypted medical record hashes, titles, descriptions, and timestamps.  
3. **AccessControl**: Manages permissions for who can view or edit records.  
4. **InheritanceManager**: Handles the transfer of data access to descendants.  
5. **Verification**: Provides public functions to verify record ownership and authenticity.  
6. **AuditTrail**: Logs all changes to records for transparency.  
7. **DuplicateGuard**: Prevents duplicate record entries using hash checks.

### Example Workflow
1. **Register**: A user calls `UserRegistry` to create their profile and link family members.  
2. **Add Record**: Submit a medical record hash to `MedicalRecord` with metadata (e.g., "Diabetes Diagnosis, 2025").  
3. **Grant Access**: Use `AccessControl` to allow a doctor to view specific records.  
4. **Inherit Data**: Set up `InheritanceManager` to pass access to a child upon a condition (e.g., reaching adulthood).  
5. **Verify**: A third party uses `Verification` to confirm the record’s authenticity.  
6. **Audit**: Check `AuditTrail` for a history of updates to ensure no tampering.  
7. **Prevent Duplicates**: `DuplicateGuard` ensures no duplicate hashes are registered.

## 🚀 Getting Started

### Prerequisites
- [Stacks CLI](https://docs.stacks.co/stacks-101/stacks-cli) for deploying contracts.  
- [Clarity](https://docs.stacks.co/write-smart-contracts) for writing and testing smart contracts.  
- A Stacks wallet (e.g., Hiro Wallet) for interacting with the blockchain.

### Installation
1. Clone this repository:
   ```bash
   git clone https://github.com/your-repo/family-health-tree.git
   ```
2. Navigate to the project directory:
   ```bash
   cd family-health-tree
   ```
3. Deploy the smart contracts using Stacks CLI:
   ```bash
   stacks deploy contracts/*
   ```

### Usage
- **Register a User**: Call `register-user` in `UserRegistry` with your Stacks address and family links.  
- **Add a Record**: Use `add-record` in `MedicalRecord` with the SHA-256 hash of your medical data, title, and description.  
- **Grant Access**: Call `grant-access` in `AccessControl` to share records with another address.  
- **Verify Records**: Use `verify-record` in `Verification` to check ownership and timestamps.  
- **Set Inheritance**: Configure `set-inheritor` in `InheritanceManager` for descendants.  

