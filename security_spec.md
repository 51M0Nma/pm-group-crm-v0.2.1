# Security Specification - PM Group CRM

## Data Invariants
1. **Users**: Every user must have a unique ID matching their Auth UID. Roles are strictly hierarchical: `SuperAdmin` > `SubAdmin` > `Associate`.
2. **Leads**: Leads must be assigned to a user. Only the assigned user or admins can view/edit leads.
3. **Tasks**: Tasks must be linked to a lead and assigned to a user. Only the assignee, assignor, or admins can interact with a task.
4. **Audit Logs**: Immutable. Only readable by admins. Cannot be deleted or updated.
5. **Sheet Configurations**: Manage external sync sources. Only SuperAdmins can modify these.
6. **Chat Messages**: Private between sender and receiver.

## The Dirty Dozen Payloads (Attack Vectors)

### 1. Identity Spoofing - User Creation
A user tries to create their own profile with `role: "SuperAdmin"`.
```json
{
  "id": "malicious-user-id",
  "role": "SuperAdmin",
  "name": "Attacker"
}
```
**Expected Result**: PERMISSION_DENIED.

### 2. Privilege Escalation - Role Update
An `Associate` tries to update their own role to `SuperAdmin`.
```json
{
  "role": "SuperAdmin"
}
```
**Expected Result**: PERMISSION_DENIED.

### 3. Resource Poisoning - Junk ID
Attacker tries to create a document with a massive ID string to exhaust resources.
```javascript
// Path: leads/LONG_JUNK_STRING_1024_CHARS
```
**Expected Result**: PERMISSION_DENIED.

### 4. Orphaned Write - Missing Parent
Creating a task for a non-existent lead.
```json
{
  "leadId": "non-existent-lead",
  "title": "Ghost Task"
}
```
**Expected Result**: PERMISSION_DENIED.

### 5. Integrity Breach - Backdated Audit
Attempting to create an audit log with a manual timestamp instead of `request.time`.
```json
{
  "timestamp": "2020-01-01T00:00:00Z"
}
```
**Expected Result**: PERMISSION_DENIED.

### 6. Unauthorized Read - PII Leak
An `Associate` tries to list all `users` with their private emails.
**Expected Result**: PERMISSION_DENIED (unless they are the owner).

### 7. Global Config Hijack
An `Associate` tries to update `sheetConfigs`.
**Expected Result**: PERMISSION_DENIED.

### 8. Shadow Field Injection
Adding a `isVerified: true` field to a `Lead` document that isn't in the schema.
**Expected Result**: PERMISSION_DENIED.

### 9. Terminal State Bypass
Attempting to move a task from `Complete` back to `Pending` without admin rights.
**Expected Result**: PERMISSION_DENIED.

### 10. Chat Snooping
User A tries to read messages where they are neither the `senderId` nor `receiverId`.
**Expected Result**: PERMISSION_DENIED.

### 11. Immutability Violation - Lead Change
Trying to change the `assignedTo` field of a lead after it has been set (if business rules forbid it).
**Expected Result**: PERMISSION_DENIED.

### 12. Denial of Wallet - List Query Scraping
Listing all leads without a filter for `assignedTo`.
**Expected Result**: PERMISSION_DENIED.
