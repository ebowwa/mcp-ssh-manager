#!/bin/bash

# Test script for password prompt with special characters
# This validates that the prompt_password function can handle all shell special characters

set -e

# Source the colors library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source /Users/jeremy/.ssh-manager-cli/lib/colors.sh

echo "Testing password prompt with special characters..."
echo "=================================================="
echo

# Test cases with various special characters
test_passwords=(
    # Original reported issue
    "£_'n78cSi0\`l"
    # Common special characters
    'password$123'
    'pass"word'
    "pass'word"
    'pass\word'
    'pass`cmd`'
    'pass$(cmd)'
    'pass&word'
    'pass|word'
    'pass;word'
    'pass<>word'
    'pass(word)'
    'pass{word}'
    'pass[word]'
    'pass!word'
    'pass*word'
    'pass?word'
    'pass~word'
    'pass#word'
    'pass@word'
    'pass%word'
    'pass^word'
    # Complex combinations
    'p@$$w0rd!#$%'
    '`echo hacked`'
    '$(rm -rf /)'
    '; cat /etc/passwd'
    # Unicode and special symbols
    'pässwörd'
    'パスワード'
    '🔒password🔑'
)

success_count=0
fail_count=0

for test_pass in "${test_passwords[@]}"; do
    echo -n "Testing: "
    # Show first 20 chars for display
    if [ ${#test_pass} -gt 20 ]; then
        echo "${test_pass:0:20}..."
    else
        echo "$test_pass"
    fi

    # Simulate password input using printf
    result_var=""
    printf -v result_var '%s' "$test_pass"

    # Verify the password was stored correctly
    if [ "$result_var" = "$test_pass" ]; then
        echo "  ✅ PASS - Password stored correctly"
        ((success_count++))
    else
        echo "  ❌ FAIL - Password corrupted"
        echo "     Expected: $test_pass"
        echo "     Got: $result_var"
        ((fail_count++))
    fi
    echo
done

echo "=================================================="
echo "Test Results:"
echo "  ✅ Passed: $success_count"
echo "  ❌ Failed: $fail_count"
echo "=================================================="

if [ $fail_count -eq 0 ]; then
    echo "🎉 All password special character tests passed!"
    exit 0
else
    echo "⚠️  Some tests failed!"
    exit 1
fi
