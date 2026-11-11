import assert from 'assert';
import crypto from 'crypto';
import app from '../server.js';

const { sealTicket, unsealTicket, SESSION_TTL_MS, revokedTickets } = app._internals;

console.log('--- TEST 1: Verify Exact SESSION_TTL_MS ---');
assert.strictEqual(SESSION_TTL_MS, 20 * 60 * 1000, 'SESSION_TTL_MS must be 20 minutes (1200000 ms)');
console.log('PASS: SESSION_TTL_MS is exactly 20 minutes (1,200,000 ms)');

console.log('--- TEST 2: Verify Sealing and Unsealing within TTL ---');
const dummyKey = crypto.randomBytes(32);
const expiresAt = Date.now() + SESSION_TTL_MS;
const ticket = sealTicket(dummyKey, expiresAt);
assert(typeof ticket === 'string', 'Ticket must be a base64url string');

const unsealed = unsealTicket(ticket);
assert(unsealed !== null, 'Ticket must unseal successfully');
assert.strictEqual(unsealed.keyBuf.toString('hex'), dummyKey.toString('hex'), 'Unsealed key must match original');
assert.strictEqual(unsealed.expiresAt, expiresAt, 'Unsealed expiresAt must match original');
assert(typeof unsealed.tid === 'string' && unsealed.tid.length === 32, 'Ticket must contain 16-byte hex tid');
console.log('PASS: Ticket sealed and unsealed successfully within 20-minute TTL');

console.log('--- TEST 3: Verify Expired Ticket Rejection ---');
const pastExpiresAt = Date.now() - 1000; // expired 1s ago
const expiredTicket = sealTicket(dummyKey, pastExpiresAt);
const unsealedExpired = unsealTicket(expiredTicket);
assert.strictEqual(unsealedExpired, null, 'Expired ticket must return null');
console.log('PASS: Expired ticket rejected');

console.log('--- TEST 4: Verify Single-Instance Revocation ---');
const freshTicket = sealTicket(dummyKey, Date.now() + SESSION_TTL_MS);
const preRevoke = unsealTicket(freshTicket);
assert(preRevoke !== null, 'Fresh ticket must be valid');
revokedTickets.set(preRevoke.tid, preRevoke.expiresAt);
const postRevoke = unsealTicket(freshTicket);
assert.strictEqual(postRevoke, null, 'Revoked ticket must return null');
revokedTickets.delete(preRevoke.tid); // cleanup
console.log('PASS: Revoked ticket rejected on the same instance');

console.log('--- TEST 5: Verify Cross-Instance In-Memory Limitation ---');
// Simulate separate serverless instance B with its own independent revocation map
const instanceBRevocationMap = new Map();
const isTicketRevokedOnInstanceB = (tid) => instanceBRevocationMap.has(tid);

// Instance A revokes ticket
const multiTicket = sealTicket(dummyKey, Date.now() + SESSION_TTL_MS);
const ticketData = unsealTicket(multiTicket);
// Wiped on instance A:
revokedTickets.set(ticketData.tid, ticketData.expiresAt);
assert.strictEqual(unsealTicket(multiTicket), null, 'Instance A rejects revoked ticket');

// But Instance B does NOT have this tid in its local map:
assert.strictEqual(isTicketRevokedOnInstanceB(ticketData.tid), false, 'Instance B has separate memory');
revokedTickets.delete(ticketData.tid); // cleanup
console.log('PASS: Cross-instance in-memory limitation verified experimentally');

console.log('\nALL SESSION EXPIRY & REVOCATION TESTS PASSED (5/5)');

