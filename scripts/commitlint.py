"""
Commit Message Linter

This script validates Git commit messages to ensure they follow the conventional commit format.
It checks for a specific structure in the commit message, including a type prefix and a message
of appropriate length. The script is intended to be used as a `commit-msg` hook in Git to enforce
consistent commit message standards.

The expected format is:
    <type>: <message>

Where:
- `type` is one of: feat, fix, docs, style, refactor, test, chore, perf, ci, revert, wip, hotfix.
- The message should not exceed 72 characters.

Examples of valid commit messages:
    feat: add user authentication to the login page
    fix: resolve crashing issue during image upload
"""

import re
import sys


def main():
    """
    Validates the Git commit message against the conventional commit format.

    Reads the commit message from the file passed as the first argument. If the commit
    message does not match the expected format, a detailed error message is displayed,
    and the script exits with a non-zero status code.

    Returns:
        None
    """
    commit_msg_filepath = sys.argv[1]
    with open(commit_msg_filepath, "r", encoding="utf-8") as f:
        commit_msg = f.read().strip()
    # Debug: Print the raw commit message
    print(f"Raw commit message:\n{commit_msg}")
    # Normalize the commit message
    commit_msg_lines = commit_msg.splitlines()
    commit_msg = commit_msg_lines[0].strip()  # Only validate the first line
    # Define the regex for the commit type
    valid_types = [
        "feat",
        "fix",
        "docs",
        "style",
        "refactor",
        "test",
        "chore",
        "perf",
        "ci",
        "revert",
        "wip",
        "hotfix",
    ]
    type_regex = f"^({'|'.join(valid_types)}): "
    # Check if the type is valid
    if not re.match(type_regex, commit_msg):
        print(
            "ERROR: Commit message must start with a valid keyword followed by a colon.\n"
            f"Valid keywords are: {', '.join(valid_types)}.\n"
            "Example: feat: add user authentication to the login page"
        )
        sys.exit(1)
    # Check if the first line of the commit message is too long
    if len(commit_msg) > 72:
        print(
            f"ERROR: Commit message is too long. It should not exceed 72 characters.\n"
            f"Your message has {len(commit_msg)} characters.\n"
            "Example: feat: add user authentication to the login page"
        )
        sys.exit(1)
    # If it passes all checks
    print("Commit message format is valid.")
    sys.exit(0)


if __name__ == "__main__":
    main()
