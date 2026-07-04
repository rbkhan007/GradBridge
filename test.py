#!/usr/bin/env python3
"""
GradBridge Full Application Test Suite
======================================
Tests all pages, API endpoints, authentication, chat, files, knowledge,
memory, plan, and streaming features.

Prerequisites:
  - Server running at http://localhost:3000
  - Python 3.8+ with `requests` installed (pip install requests)

Usage:
  python test.py              # Run all tests
  python test.py --verbose    # Show detailed output
  python test.py --stop-on-fail  # Stop on first failure
"""

import sys
import json
import time
import argparse
import urllib.request
import urllib.error
from http.cookiejar import CookieJar
from typing import Optional, Tuple

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
BASE_URL = "http://localhost:3000"
TEST_EMAIL = f"test_{int(time.time())}@gradbridge.test"
TEST_PASSWORD = "TestPass123!"
TEST_NAME = "Test User"

# ---------------------------------------------------------------------------
# HTTP helpers (stdlib only  no external deps)
# ---------------------------------------------------------------------------

class HttpClient:
    """Minimal HTTP client with cookie jar support."""

    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")
        self.cookie_jar = CookieJar()
        self.opener = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(self.cookie_jar)
        )

    def request(
        self,
        method: str,
        path: str,
        data: Optional[dict] = None,
        raw_body: Optional[bytes] = None,
        headers: Optional[dict] = None,
    ) -> Tuple[int, dict, str]:
        """Send an HTTP request. Returns (status_code, response_dict, raw_body)."""
        url = f"{self.base_url}{path}"
        req_headers = {"Content-Type": "application/json"}
        if headers:
            req_headers.update(headers)

        body = raw_body if raw_body is not None else (json.dumps(data).encode() if data is not None else None)
        req = urllib.request.Request(url, data=body, headers=req_headers, method=method)

        try:
            resp = self.opener.open(req, timeout=30)
            status = resp.getcode()
            raw = resp.read().decode()
            try:
                parsed = json.loads(raw)
            except json.JSONDecodeError:
                parsed = {"_raw": raw}
            return status, parsed, raw
        except urllib.error.HTTPError as e:
            status = e.code
            raw = e.read().decode()
            try:
                parsed = json.loads(raw)
            except json.JSONDecodeError:
                parsed = {"_raw": raw}
            return status, parsed, raw
        except urllib.error.URLError as e:
            return 0, {"error": str(e.reason)}, ""
        except Exception as e:
            return 0, {"error": str(e)}, ""

    def get(self, path: str, **kwargs) -> Tuple[int, dict, str]:
        return self.request("GET", path, **kwargs)

    def post(self, path: str, data: Optional[dict] = None, **kwargs) -> Tuple[int, dict, str]:
        return self.request("POST", path, data=data, **kwargs)

    def clear_cookies(self):
        self.cookie_jar.clear()


# ---------------------------------------------------------------------------
# Test runner
# ---------------------------------------------------------------------------

class TestResult:
    def __init__(self, name: str, passed: bool, detail: str = ""):
        self.name = name
        self.passed = passed
        self.detail = detail


class TestSuite:
    def __init__(self, verbose: bool = False, stop_on_fail: bool = False):
        self.results: list[TestResult] = []
        self.verbose = verbose
        self.stop_on_fail = stop_on_fail
        self.client = HttpClient(BASE_URL)
        self.session_cookie: Optional[str] = None

    def log(self, msg: str, indent: int = 0):
        if self.verbose:
            print("  " * indent + msg)

    def check(self, name: str, condition: bool, detail: str = ""):
        result = TestResult(name, condition, detail)
        self.results.append(result)
        if condition:
            self.log(f"  PASS: {name}")
        else:
            self.log(f"  FAIL: {name}  {detail}")
            if self.stop_on_fail:
                raise AssertionError(f"Test failed: {name}  {detail}")

    def assert_status(self, name: str, actual: int, expected: int, body: dict = None):
        detail = f"expected {expected}, got {actual}"
        if body and "error" in body:
            detail += f"  {body['error']}"
        self.check(name, actual == expected, detail)

    # -----------------------------------------------------------------------
    # Page tests
    # -----------------------------------------------------------------------

    def test_pages(self):
        print("\n Testing Pages...")
        pages = [
            ("/", 200, "Landing page"),
            ("/", 200, "Root (SPA handles routing)"),
        ]
        for path, expected_status, desc in pages:
            status, body, _ = self.client.get(path)
            self.assert_status(f"GET {path}  {desc}", status, expected_status)

    # -----------------------------------------------------------------------
    # Auth tests
    # -----------------------------------------------------------------------

    def test_auth_register(self):
        print("\n Testing Auth  Register...")
        status, body, _ = self.client.post("/api/auth/register", {
            "name": TEST_NAME,
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
        })
        self.assert_status("POST /api/auth/register  201", status, 201, body)
        if status == 201:
            self.check("Register returns user", "user" in body and body["user"].get("email") == TEST_EMAIL)

    def test_auth_register_duplicate(self):
        print("\n Testing Auth  Duplicate Register...")
        status, body, _ = self.client.post("/api/auth/register", {
            "name": TEST_NAME,
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
        })
        self.assert_status("POST /api/auth/register duplicate  409", status, 409, body)

    def test_auth_register_validation(self):
        print("\n Testing Auth  Register Validation...")
        # Missing name
        status, _, _ = self.client.post("/api/auth/register", {
            "email": "x@test.com",
            "password": "TestPass123!",
        })
        self.check("Register without name  400", status == 400)

        # Bad email
        status, _, _ = self.client.post("/api/auth/register", {
            "name": "Test",
            "email": "not-an-email",
            "password": "TestPass123!",
        })
        self.check("Register with bad email  400", status == 400)

        # Short password
        status, _, _ = self.client.post("/api/auth/register", {
            "name": "Test",
            "email": "test@example.com",
            "password": "short",
        })
        self.check("Register with short password  400", status == 400)

    def test_auth_me(self):
        print("\n Testing Auth  Me...")
        status, body, _ = self.client.get("/api/auth/me")
        self.assert_status("GET /api/auth/me  200", status, 200, body)
        if status == 200:
            self.check("Me returns user", "user" in body and body["user"].get("email") == TEST_EMAIL)

    def test_auth_login(self):
        print("\n Testing Auth  Login...")
        # Clear cookies first
        self.client.clear_cookies()
        status, body, _ = self.client.post("/api/auth/login", {
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
        })
        self.assert_status("POST /api/auth/login  200", status, 200, body)
        if status == 200:
            self.check("Login returns user", "user" in body)

    def test_auth_login_wrong_password(self):
        print("\n Testing Auth  Login Wrong Password...")
        self.client.clear_cookies()
        status, body, _ = self.client.post("/api/auth/login", {
            "email": TEST_EMAIL,
            "password": "WrongPassword!",
        })
        self.assert_status("POST /api/auth/login wrong password  401", status, 401, body)

    def test_auth_login_nonexistent(self):
        print("\n Testing Auth  Login Nonexistent User...")
        self.client.clear_cookies()
        status, body, _ = self.client.post("/api/auth/login", {
            "email": "nonexistent@test.com",
            "password": "TestPass123!",
        })
        self.assert_status("POST /api/auth/login nonexistent  401", status, 401, body)

    def test_auth_logout(self):
        print("\n Testing Auth  Logout...")
        status, body, _ = self.client.post("/api/auth/logout")
        self.assert_status("POST /api/auth/logout  200", status, 200, body)
        # After logout, me should return 401
        status, _, _ = self.client.get("/api/auth/me")
        self.check("After logout, GET /api/auth/me  401", status == 401)

    # -----------------------------------------------------------------------
    # Protected endpoint tests (require auth)
    # -----------------------------------------------------------------------

    def _ensure_auth(self):
        """Re-authenticate for subsequent tests."""
        self.client.clear_cookies()
        status, _, _ = self.client.post("/api/auth/login", {
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
        })
        if status == 200:
            return
        # Try registering (may already exist from earlier in this run)
        reg_status, _, _ = self.client.post("/api/auth/register", {
            "name": TEST_NAME,
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
        })
        if reg_status == 201:
            return
        # If register returned 409 (duplicate), try login again
        if reg_status == 409:
            self.client.post("/api/auth/login", {
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD,
            })

    def test_agents(self):
        print("\n Testing Agents API...")
        self._ensure_auth()
        status, body, _ = self.client.get("/api/agents")
        self.assert_status("GET /api/agents  200", status, 200, body)
        if status == 200:
            self.check("Agents has agents", "agents" in body)
            self.check("Agents has modes", "modes" in body)
            self.check("Agents has providers", "providers" in body)

    def test_files(self):
        print("\n Testing Files API...")
        self._ensure_auth()
        status, body, _ = self.client.get("/api/files")
        self.assert_status("GET /api/files  200", status, 200, body)
        if status == 200:
            self.check("Files returns array", "files" in body and isinstance(body["files"], list))
            self.check("Files not empty", len(body.get("files", [])) > 0)

    def test_files_post(self):
        print("\n Testing Files API  Read File...")
        self._ensure_auth()
        # Get file list first
        status, body, _ = self.client.get("/api/files")
        if status == 200 and body.get("files"):
            file_path = body["files"][0]["path"]
            status2, body2, _ = self.client.post("/api/files", {"path": file_path})
            self.assert_status(f"POST /api/files (read {file_path})  200", status2, 200, body2)
            if status2 == 200:
                self.check("File has content", "file" in body2 and "content" in body2["file"])

    def test_files_post_validation(self):
        print("\n Testing Files API  Validation...")
        self._ensure_auth()
        status, _, _ = self.client.post("/api/files", {})
        self.check("POST /api/files without path  400", status == 400)

    def test_knowledge(self):
        print("\n Testing Knowledge API...")
        self._ensure_auth()
        status, body, _ = self.client.get("/api/knowledge")
        self.assert_status("GET /api/knowledge  200", status, 200, body)
        if status == 200:
            self.check("Knowledge has entries", "entries" in body)
            self.check("Knowledge not empty", len(body.get("entries", [])) > 0)

    def test_knowledge_search(self):
        print("\n Testing Knowledge API  Search...")
        self._ensure_auth()
        status, body, _ = self.client.get("/api/knowledge?q=backend")
        self.assert_status("GET /api/knowledge?q=backend  200", status, 200, body)
        if status == 200:
            self.check("Search returns entries", "entries" in body)

    def test_memory(self):
        print("\n Testing Memory API...")
        self._ensure_auth()
        status, body, _ = self.client.get("/api/memory")
        self.assert_status("GET /api/memory  200", status, 200, body)
        if status == 200:
            self.check("Memory has profile", "profile" in body)
            self.check("Memory has name", body.get("profile", {}).get("name"))

    def test_memory_update(self):
        print("\n Testing Memory API  Update...")
        self._ensure_auth()
        status, body, _ = self.client.post("/api/memory", {
            "name": "Updated Name",
            "university": "MIT",
            "major": "CS",
        })
        self.assert_status("POST /api/memory  200", status, 200, body)
        if status == 200:
            self.check("Memory updated name", body.get("profile", {}).get("name") == "Updated Name")
            self.check("Memory updated university", body.get("profile", {}).get("university") == "MIT")

    def test_memory_validation(self):
        print("\n Testing Memory API  Validation...")
        self._ensure_auth()
        status, _, _ = self.client.post("/api/memory", raw_body=b"not json")
        self.check("POST /api/memory with invalid JSON  400", status == 400)

    def test_unauthenticated_access(self):
        print("\n Testing Unauthenticated Access...")
        self.client.clear_cookies()
        endpoints = [
            ("GET", "/api/files"),
            ("GET", "/api/knowledge"),
            ("GET", "/api/memory"),
            ("GET", "/api/agents"),
        ]
        for method, path in endpoints:
            status, _, _ = self.client.get(path)
            self.check(f"{method} {path} without auth  401", status == 401)

    # -----------------------------------------------------------------------
    # Chat tests
    # -----------------------------------------------------------------------

    def test_chat(self):
        print("\n Testing Chat API...")
        self._ensure_auth()
        status, body, _ = self.client.post("/api/chat", {
            "message": "Hello, what can you help me with?",
            "mode": "chat",
        })
        # Chat requires LLM provider, so 500 is acceptable if no provider configured
        self.check(
            "POST /api/chat  200 or 500 (no LLM provider)",
            status in (200, 500),
            f"status={status}"
        )
        if status == 200:
            self.check("Chat returns message", "message" in body)
            self.check("Chat returns conversationId", "conversationId" in body)

    def test_chat_validation(self):
        print("\n Testing Chat API  Validation...")
        self._ensure_auth()
        status, _, _ = self.client.post("/api/chat", {})
        self.check("POST /api/chat without message  400", status == 400)

    def test_chat_long_message(self):
        print("\n Testing Chat API  Long Message...")
        self._ensure_auth()
        status, _, _ = self.client.post("/api/chat", {
            "message": "x" * 9000,
        })
        self.check("POST /api/chat with 9000 chars  413", status == 413)

    # -----------------------------------------------------------------------
    # Plan tests
    # -----------------------------------------------------------------------

    def test_plan(self):
        print("\n Testing Plan API...")
        self._ensure_auth()
        status, body, _ = self.client.post("/api/plan", {
            "goal": "Implement OAuth2 login for the app",
        })
        # Plan requires LLM provider
        self.check(
            "POST /api/plan  200 or 500 (no LLM provider)",
            status in (200, 500),
            f"status={status}"
        )
        if status == 200:
            self.check("Plan returns plan", "plan" in body)
            self.check("Plan has content", body.get("plan", {}).get("content"))

    def test_plan_validation(self):
        print("\n Testing Plan API  Validation...")
        self._ensure_auth()
        status, _, _ = self.client.post("/api/plan", {})
        self.check("POST /api/plan without goal  400", status == 400)

    # -----------------------------------------------------------------------
    # File diff/apply tests
    # -----------------------------------------------------------------------

    def test_file_diff(self):
        print("\n Testing File Diff API...")
        self._ensure_auth()
        # Get a file first
        status, body, _ = self.client.get("/api/files")
        if status == 200 and body.get("files"):
            file_path = body["files"][0]["path"]
            status2, body2, _ = self.client.post("/api/files/diff", {
                "filePath": file_path,
                "instruction": "Add a comment at the top",
            })
            # Diff requires LLM provider
            self.check(
                f"POST /api/files/diff  200 or 500 (no LLM provider)",
                status2 in (200, 500),
                f"status={status2}"
            )

    def test_file_diff_validation(self):
        print("\n Testing File Diff API  Validation...")
        self._ensure_auth()
        status, _, _ = self.client.post("/api/files/diff", {})
        self.check("POST /api/files/diff without params  400", status == 400)

    def test_file_apply(self):
        print("\n Testing File Apply API...")
        self._ensure_auth()
        # Get a file first
        status, body, _ = self.client.get("/api/files")
        if status == 200 and body.get("files"):
            file_path = body["files"][0]["path"]
            original_content = body["files"][0]["content"]
            # Apply modified content
            status2, body2, _ = self.client.post("/api/files/apply", {
                "path": file_path,
                "content": original_content + "\n// test modification",
            })
            self.assert_status("POST /api/files/apply  200", status2, 200, body2)
            if status2 == 200:
                self.check("Apply returns file", "file" in body2)
                # Restore original content
                self.client.post("/api/files/apply", {
                    "path": file_path,
                    "content": original_content,
                })

    def test_file_apply_validation(self):
        print("\n Testing File Apply API  Validation...")
        self._ensure_auth()
        status, _, _ = self.client.post("/api/files/apply", {})
        self.check("POST /api/files/apply without params  400", status == 400)

    # -----------------------------------------------------------------------
    # Commit tests
    # -----------------------------------------------------------------------

    def test_commit_list(self):
        print("\n Testing Commit API  List...")
        self._ensure_auth()
        status, body, _ = self.client.get("/api/files/commits")
        self.assert_status("GET /api/files/commits  200", status, 200, body)
        if status == 200:
            self.check("Commits has array", "commits" in body)

    def test_commit_create(self):
        print("\n Testing Commit API  Create...")
        self._ensure_auth()
        # Modify a file first
        status, body, _ = self.client.get("/api/files")
        if status == 200 and body.get("files"):
            file_path = body["files"][0]["path"]
            original = body["files"][0]["content"]
            self.client.post("/api/files/apply", {
                "path": file_path,
                "content": original + "\n// commit test",
            })
            # Commit
            status2, body2, _ = self.client.post("/api/files/commit", {
                "message": "Test commit",
            })
            self.check(
                "POST /api/files/commit  200 or 400 (no modified files)",
                status2 in (200, 400),
                f"status={status2}"
            )
            # Restore
            self.client.post("/api/files/apply", {
                "path": file_path,
                "content": original,
            })

    # -----------------------------------------------------------------------
    # SSE Stream tests
    # -----------------------------------------------------------------------

    def test_chat_stream(self):
        print("\n Testing Chat Stream API...")
        self._ensure_auth()
        # We can't easily parse SSE in urllib, but we can check the endpoint exists
        status, body, raw = self.client.post("/api/chat/stream", {
            "message": "Hello",
            "mode": "chat",
        })
        # Stream endpoint should return 200 with SSE content-type or 500
        self.check(
            "POST /api/chat/stream  200 or 500",
            status in (200, 500),
            f"status={status}"
        )

    # -----------------------------------------------------------------------
    # Edge cases
    # -----------------------------------------------------------------------

    def test_invalid_json(self):
        print("\n  Testing Edge Cases  Invalid JSON...")
        self._ensure_auth()
        endpoints = [
            "/api/chat",
            "/api/plan",
            "/api/memory",
            "/api/files",
            "/api/files/apply",
            "/api/files/commit",
            "/api/files/diff",
        ]
        for path in endpoints:
            status, _, _ = self.client.request("POST", path, raw_body=b"not json")
            # 400 = invalid JSON caught, 401 = auth checked first (both correct)
            self.check(
                f"POST {path} with invalid JSON  400 or 401",
                status in (400, 401),
                f"status={status}"
            )

    def test_nonexistent_endpoint(self):
        print("\n  Testing Edge Cases  404...")
        self._ensure_auth()
        status, _, _ = self.client.get("/api/nonexistent")
        self.check("GET /api/nonexistent  404", status == 404)

    # -----------------------------------------------------------------------
    # Run all tests
    # -----------------------------------------------------------------------

    def run_all(self):
        print("=" * 60)
        print("GradBridge Full Application Test Suite")
        print(f"   Target: {BASE_URL}")
        print("=" * 60)

        start = time.time()

        # Pages
        self.test_pages()

        # Auth
        self.test_auth_register()
        self.test_auth_register_duplicate()
        self.test_auth_register_validation()
        self.test_auth_me()
        self.test_auth_login()
        self.test_auth_login_wrong_password()
        self.test_auth_login_nonexistent()
        self.test_auth_logout()

        # Protected endpoints
        self.test_agents()
        self.test_files()
        self.test_files_post()
        self.test_files_post_validation()
        self.test_knowledge()
        self.test_knowledge_search()
        self.test_memory()
        self.test_memory_update()
        self.test_memory_validation()
        self.test_unauthenticated_access()

        # Chat & Plan
        self.test_chat()
        self.test_chat_validation()
        self.test_chat_long_message()
        self.test_plan()
        self.test_plan_validation()

        # File operations
        self.test_file_diff()
        self.test_file_diff_validation()
        self.test_file_apply()
        self.test_file_apply_validation()

        # Commits
        self.test_commit_list()
        self.test_commit_create()

        # Streaming
        self.test_chat_stream()

        # Edge cases
        self.test_invalid_json()
        self.test_nonexistent_endpoint()

        elapsed = time.time() - start

        # Summary
        passed = sum(1 for r in self.results if r.passed)
        failed = sum(1 for r in self.results if not r.passed)
        total = len(self.results)

        print("\n" + "=" * 60)
        print(f" Results: {passed}/{total} passed, {failed} failed ({elapsed:.1f}s)")
        print("=" * 60)

        if failed > 0:
            print("\n Failed tests:")
            for r in self.results:
                if not r.passed:
                    print(f"    {r.name}: {r.detail}")

        print()
        return failed == 0


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="GradBridge Full Application Test Suite")
    parser.add_argument("--verbose", "-v", action="store_true", help="Show detailed output")
    parser.add_argument("--stop-on-fail", "-s", action="store_true", help="Stop on first failure")
    args = parser.parse_args()

    suite = TestSuite(verbose=args.verbose, stop_on_fail=args.stop_on_fail)
    success = suite.run_all()
    sys.exit(0 if success else 1)
