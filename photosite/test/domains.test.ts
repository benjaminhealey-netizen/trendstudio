import assert from "node:assert/strict";
import test from "node:test";
import {
  cnameMatches,
  isApex,
  isValidHostname,
  nameserversMatch,
  normaliseHostname,
  registrableDomain,
} from "../src/lib/domains/dns";

test("apex detection handles multi-label suffixes", () => {
  assert.equal(isApex("janedoe.com"), true);
  assert.equal(isApex("janedoe.co.uk"), true);
  assert.equal(isApex("www.janedoe.com"), false);
  assert.equal(isApex("www.janedoe.co.uk"), false);
});

test("registrable domain is the name whose nameservers matter", () => {
  assert.equal(registrableDomain("www.janedoe.com"), "janedoe.com");
  assert.equal(registrableDomain("shop.janedoe.co.uk"), "janedoe.co.uk");
  assert.equal(registrableDomain("janedoe.com"), "janedoe.com");
});

test("hostnames are normalised from whatever the client pastes in", () => {
  assert.equal(normaliseHostname(" HTTPS://Www.JaneDoe.com/gallery "), "www.janedoe.com");
  assert.equal(normaliseHostname("janedoe.com."), "janedoe.com");
});

test("obvious rubbish is rejected", () => {
  assert.equal(isValidHostname("janedoe.com"), true);
  assert.equal(isValidHostname("not a domain"), false);
  assert.equal(isValidHostname("janedoe"), false);
  assert.equal(isValidHostname("-bad.com"), false);
});

test("nameserver match ignores case and trailing dots, and needs all of them", () => {
  const expected = ["kate.ns.cloudflare.com", "rob.ns.cloudflare.com"];
  assert.equal(nameserversMatch(["KATE.ns.cloudflare.com.", "rob.ns.cloudflare.com"], expected), true);
  assert.equal(nameserversMatch(["kate.ns.cloudflare.com"], expected), false);
  assert.equal(nameserversMatch([], expected), false);
  assert.equal(nameserversMatch(["kate.ns.cloudflare.com"], []), false);
});

test("cname match compares against the pages.dev target", () => {
  assert.equal(cnameMatches(["jane-abc123.pages.dev."], "jane-abc123.pages.dev"), true);
  assert.equal(cnameMatches(["something-else.pages.dev"], "jane-abc123.pages.dev"), false);
});
