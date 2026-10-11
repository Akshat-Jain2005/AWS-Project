#!/usr/bin/env python3
"""Provision an invite-only operator or reporter account (password + TOTP MFA).

Operator and reporter sign-in is invite-only — there is no self-service signup.
Run this once per staff member to create their account and enrol their
authenticator. Requires the DynamoDB table (run create_table.py first) and the
usual AWS / DynamoDB-Local config in the environment.

Usage:
    python provision_staff.py operator ops@djb.example "Jane Operator"
    python provision_staff.py reporter field@djb.example "Field Reporter" --password 'correct horse battery'

Prints the authenticator secret and otpauth URI once — add it to Google
Authenticator / Authy / 1Password, then sign in with email + password + code.
"""
import argparse
import getpass
import secrets

from app import accounts, totp


def main():
    p = argparse.ArgumentParser(description="Provision an operator or reporter account")
    p.add_argument("role", choices=["operator", "reporter"])
    p.add_argument("email")
    p.add_argument("name", nargs="?", default="")
    p.add_argument("--password", help="account password (prompted if omitted)")
    args = p.parse_args()

    password = args.password or getpass.getpass("Password (blank to auto-generate): ") or None
    generated = None
    if not password:
        generated = secrets.token_urlsafe(12)
        password = generated
    if len(password) < 8:
        p.error("password must be at least 8 characters")

    record, secret = accounts.create_staff(args.email, args.name, password, args.role)
    uri = totp.provisioning_uri(secret, record["email"])

    print(f"\n  {args.role} account ready: {record['email']}")
    if generated:
        print(f"  generated password:   {generated}")
    print(f"  authenticator secret: {secret}")
    print(f"  otpauth URI:          {uri}")
    print("\nAdd the secret to an authenticator app, then sign in with "
          "email + password + the 6-digit code.\n")


if __name__ == "__main__":
    main()
