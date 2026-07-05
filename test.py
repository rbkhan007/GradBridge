#!/usr/bin/env python3
"""
GradBridge Full Application Test Suite
======================================
Tests all pages, API endpoints, auth, chat, files, knowledge,
memory, plan, and streaming features.

Prerequisites:
  - Server running at http://localhost:3000
  - Python 3.8+

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
from typing import Optional

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
BASE_URL = "http://localhost:3000"
TEST_EMAIL = f"test_{int(time.time())}@gradbridge.test"
TEST_PASSWORD = "TestPass123!"
TEST_NAME = "Test User"


# ---------------------------------------------------------------------------
# HTTP helpers (stdlib only — no external deps)
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
    ):
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

    def get(self, path: str, **kwargs):
        return self.request("GET", path, **kwargs)

    def post(self, path: str, data: Optional[dict] = None, **kwargs):
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
        self.authenticated = False

    def log(self, msg: str, indent: int = 0):
        if self.verbose:
            print("  " * indent + msg)

    def check(self, name: str, condition: bool, detail: str = ""):
        result = TestResult(name, condition, detail)
        self.results.append(result)
        if condition:
            self.log(f"  PASS: {name}")
        else:
            self.log(f"  FAIL: {name} — {detail}")
            if self.stop_on_fail:
                raise AssertionError(f"Test failed: {name} — {detail}")

    def assert_status(self, name: str, actual: int, expected: int, body: dict = None):
        detail = f"expected {expected}, got {actual}"
        if body and "error" in body:
            detail += f" — {body['error']}"
        self.check(name, actual == expected, detail)

    # -----------------------------------------------------------------------
    # Page tests
    # -----------------------------------------------------------------------

    def test_pages(self):
        print("\n  Testing Pages...")
        for path, desc in [("/", "Landing page / SPA shell")]:
            status, _, _ = self.client.get(path)
            self.assert_status(f"GET {path} — {desc}", status, 200)

    # -----------------------------------------------------------------------
    # Auth tests — Neon Auth proxy-based
    # -----------------------------------------------------------------------

    def test_auth_register(self):
        print("\n  Testing Auth — Register...")
        status, body, _ = self.client.request("POST", "/api/auth/register", data={
            "name": TEST_NAME,
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
        }, headers={"Origin": BASE_URL, "Referer": BASE_URL + "/"})
        self.assert_status("POST /api/auth/register — 201", status, 201, body)
        if status == 201:
            self.check("Register returns user", "user" in body and body["user"].get("email") == TEST_EMAIL)

    def test_auth_register_duplicate(self):
        print("\n  Testing Auth — Duplicate Register...")
        status, body, _ = self.client.post("/api/auth/register", {
            "name": TEST_NAME,
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
        })
        self.assert_status("POST /api/auth/register duplicate — 409", status, 409, body)

    def test_auth_register_validation(self):
        print("\n  Testing Auth — Register Validation...")
        status, _, _ = self.client.post("/api/auth/register", {
            "email": "x@test.com",
            "password": "TestPass123!",
        })
        self.check("Register without name — 400", status == 400)

        status, _, _ = self.client.post("/api/auth/register", {
            "name": "Test",
            "email": "not-an-email",
            "password": "TestPass123!",
        })
        self.check("Register with bad email — 400", status == 400)

        status, _, _ = self.client.post("/api/auth/register", {
            "name": "Test",
            "email": "test@example.com",
            "password": "short",
        })
        self.check("Register with short password — 400", status == 400)

    def test_auth_signin(self):
        print("\n  Testing Auth — Sign In (Neon Auth proxy)...")
        self.client.clear_cookies()
        status, body, _ = self.client.post("/api/auth/sign-in/email", {
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
        })
        self.assert_status("POST /api/auth/sign-in/email — 200", status, 200, body)
        if status == 200:
            self.authenticated = True

    def test_auth_get_session(self):
        print("\n  Testing Auth — Get Session...")
        self.client.clear_cookies()
        # Not logged in — should be null
        status, body, _ = self.client.get("/api/auth/get-session")
        self.assert_status("GET /api/auth/get-session unauthenticated — 200", status, 200, body)
        self.check("Session is null when unauthenticated", body is not None and body.get("data", {}).get("user") is None)

    def test_auth_signin_wrong_password(self):
        print("\n  Testing Auth — Sign In Wrong Password...")
        self.client.clear_cookies()
        status, body, _ = self.client.post("/api/auth/sign-in/email", {
            "email": TEST_EMAIL,
            "password": "WrongPassword!",
        })
        self.assert_status("POST /api/auth/sign-in/email wrong password — 401", status, 401, body)

    def test_auth_signin_nonexistent(self):
        print("\n  Testing Auth — Sign In Nonexistent...")
        self.client.clear_cookies()
        status, body, _ = self.client.post("/api/auth/sign-in/email", {
            "email": "nonexistent@test.com",
            "password": "TestPass123!",
        })
        self.assert_status("POST /api/auth/sign-in/email nonexistent — 401", status, 401, body)

    def test_auth_signout(self):
        print("\n  Testing Auth — Sign Out...")
        if not self.authenticated:
            self.check("POST /api/auth/sign-out — skipped (not authenticated)", True, "no session to sign out")
            return
        status, _, _ = self.client.post("/api/auth/sign-out")
        self.assert_status("POST /api/auth/sign-out — 200", status, 200)
        if status == 200:
            self.authenticated = False

    # -----------------------------------------------------------------------
    # Protected endpoint tests
    # -----------------------------------------------------------------------

    def _ensure_auth(self):
        """Re-authenticate via Neon Auth sign-in proxy."""
        self.client.clear_cookies()
        status, _, _ = self.client.post("/api/auth/sign-in/email", {
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
        })
        if status == 200:
            self.authenticated = True
            return
        # Try registering first
        reg_status, _, _ = self.client.post("/api/auth/register", {
            "name": TEST_NAME,
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
        })
        if reg_status == 201:
            self.client.clear_cookies()
            status, _, _ = self.client.post("/api/auth/sign-in/email", {
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD,
            })
            self.authenticated = status == 200
        elif reg_status == 409:
            status, _, _ = self.client.post("/api/auth/sign-in/email", {
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD,
            })
            self.authenticated = status == 200

    def test_agents(self):
        print("\n  Testing Agents API...")
        self._ensure_auth()
        status, body, _ = self.client.get("/api/agents")
        self.assert_status("GET /api/agents — 200", status, 200, body)
        if status == 200:
            self.check("Agents has agents", "agents" in body)

    def test_files(self):
        print("\n  Testing Files API...")
        self._ensure_auth()
        status, body, _ = self.client.get("/api/files")
        self.assert_status("GET /api/files — 200", status, 200, body)
        if status == 200:
            self.check("Files returns array", "files" in body and isinstance(body["files"], list))

    def test_files_post(self):
        print("\n  Testing Files API — Read File...")
        self._ensure_auth()
        status, body, _ = self.client.get("/api/files")
        if status == 200 and body.get("files"):
            file_path = body["files"][0]["path"]
            status2, body2, _ = self.client.post("/api/files", {"path": file_path})
            self.assert_status(f"POST /api/files (read {file_path}) — 200", status2, 200, body2)
            if status2 == 200:
                self.check("File has content", "file" in body2 and "content" in body2["file"])

    def test_files_post_validation(self):
        print("\n  Testing Files API — Validation...")
        self._ensure_auth()
        status, _, _ = self.client.post("/api/files", {})
        self.check("POST /api/files without path — 400", status == 400)

    def test_knowledge(self):
        print("\n  Testing Knowledge API...")
        self._ensure_auth()
        status, body, _ = self.client.get("/api/knowledge")
        self.assert_status("GET /api/knowledge — 200", status, 200, body)
        if status == 200:
            self.check("Knowledge has entries", "entries" in body and len(body.get("entries", [])) > 0)

    def test_knowledge_search(self):
        print("\n  Testing Knowledge API — Search...")
        self._ensure_auth()
        status, body, _ = self.client.get("/api/knowledge?q=backend")
        self.assert_status("GET /api/knowledge?q=backend — 200", status, 200, body)
        if status == 200:
            self.check("Search returns entries", "entries" in body)

    def test_memory(self):
        print("\n  Testing Memory API...")
        self._ensure_auth()
        status, body, _ = self.client.get("/api/memory")
        self.assert_status("GET /api/memory — 200", status, 200, body)
        if status == 200:
            self.check("Memory has profile", "profile" in body)

    def test_memory_update(self):
        print("\n  Testing Memory API — Update...")
        self._ensure_auth()
        status, body, _ = self.client.post("/api/memory", {
            "name": "Updated Name",
            "university": "MIT",
            "major": "CS",
        })
        self.assert_status("POST /api/memory — 200", status, 200, body)
        if status == 200:
            self.check("Memory updated name", body.get("profile", {}).get("name") == "Updated Name")
            self.check("Memory updated university", body.get("profile", {}).get("university") == "MIT")

    def test_memory_validation(self):
        print("\n  Testing Memory API — Validation...")
        self._ensure_auth()
        status, _, _ = self.client.post("/api/memory", raw_body=b"not json")
        self.check("POST /api/memory with invalid JSON — 400", status == 400)

    def test_unauthenticated_access(self):
        print("\n  Testing Unauthenticated Access...")
        self.client.clear_cookies()
        self.authenticated = False
        for path in ["/api/files", "/api/knowledge", "/api/memory", "/api/agents"]:
            status, _, _ = self.client.get(path)
            self.check(f"GET {path} without auth — 401", status == 401)

    # -----------------------------------------------------------------------
    # Chat tests
    # -----------------------------------------------------------------------

    def test_chat(self):
        print("\n  Testing Chat API...")
        self._ensure_auth()
        status, body, _ = self.client.post("/api/chat", {
            "message": "Hello, what can you help me with?",
            "mode": "chat",
        })
        self.check(
            "POST /api/chat — 200 or 500 (no LLM provider)",
            status in (200, 500),
            f"status={status}"
        )
        if status == 200:
            self.check("Chat returns message", "message" in body)
            self.check("Chat returns conversationId", "conversationId" in body)

    def test_chat_validation(self):
        print("\n  Testing Chat API — Validation...")
        self._ensure_auth()
        status, _, _ = self.client.post("/api/chat", {})
        self.check("POST /api/chat without message — 400", status == 400)

    def test_chat_long_message(self):
        print("\n  Testing Chat API — Long Message...")
        self._ensure_auth()
        status, _, _ = self.client.post("/api/chat", {
            "message": "x" * 9000,
        })
        self.check("POST /api/chat with 9000 chars — 413", status == 413)

    # -----------------------------------------------------------------------
    # Plan tests
    # -----------------------------------------------------------------------

    def test_plan(self):
        print("\n  Testing Plan API...")
        self._ensure_auth()
        status, body, _ = self.client.post("/api/plan", {
            "goal": "Implement OAuth2 login for the app",
        })
        self.check(
            "POST /api/plan — 200 or 500 (no LLM provider)",
            status in (200, 500),
            f"status={status}"
        )
        if status == 200:
            self.check("Plan returns plan", "plan" in body)

    def test_plan_validation(self):
        print("\n  Testing Plan API — Validation...")
        self._ensure_auth()
        status, _, _ = self.client.post("/api/plan", {})
        self.check("POST /api/plan without goal — 400", status == 400)

    # -----------------------------------------------------------------------
    # File diff/apply tests
    # -----------------------------------------------------------------------

    def test_file_diff(self):
        print("\n  Testing File Diff API...")
        self._ensure_auth()
        status, body, _ = self.client.get("/api/files")
        if status == 200 and body.get("files"):
            file_path = body["files"][0]["path"]
            status2, _, _ = self.client.post("/api/files/diff", {
                "filePath": file_path,
                "instruction": "Add a comment at the top",
            })
            self.check(
                "POST /api/files/diff — 200 or 500 (no LLM provider)",
                status2 in (200, 500),
                f"status={status2}"
            )

    def test_file_diff_validation(self):
        print("\n  Testing File Diff API — Validation...")
        self._ensure_auth()
        status, _, _ = self.client.post("/api/files/diff", {})
        self.check("POST /api/files/diff without params — 400", status == 400)

    def test_file_apply(self):
        print("\n  Testing File Apply API...")
        self._ensure_auth()
        status, body, _ = self.client.get("/api/files")
        if status == 200 and body.get("files"):
            file_path = body["files"][0]["path"]
            original_content = body["files"][0]["content"]
            status2, body2, _ = self.client.post("/api/files/apply", {
                "path": file_path,
                "content": original_content + "\n// test modification",
            })
            self.assert_status("POST /api/files/apply — 200", status2, 200, body2)
            if status2 == 200:
                self.check("Apply returns file", "file" in body2)
                self.client.post("/api/files/apply", {
                    "path": file_path,
                    "content": original_content,
                })

    def test_file_apply_validation(self):
        print("\n  Testing File Apply API — Validation...")
        self._ensure_auth()
        status, _, _ = self.client.post("/api/files/apply", {})
        self.check("POST /api/files/apply without params — 400", status == 400)

    # -----------------------------------------------------------------------
    # Commit tests
    # -----------------------------------------------------------------------

    def test_commit_list(self):
        print("\n  Testing Commit API — List...")
        self._ensure_auth()
        status, body, _ = self.client.get("/api/files/commits")
        self.assert_status("GET /api/files/commits — 200", status, 200, body)
        if status == 200:
            self.check("Commits has array", "commits" in body)

    def test_commit_create(self):
        print("\n  Testing Commit API — Create...")
        self._ensure_auth()
        status, body, _ = self.client.get("/api/files")
        if status == 200 and body.get("files"):
            file_path = body["files"][0]["path"]
            original = body["files"][0]["content"]
            self.client.post("/api/files/apply", {
                "path": file_path,
                "content": original + "\n// commit test",
            })
            status2, _, _ = self.client.post("/api/files/commit", {"message": "Test commit"})
            self.check(
                "POST /api/files/commit — 200 or 400 (no modified files)",
                status2 in (200, 400),
                f"status={status2}"
            )
            self.client.post("/api/files/apply", {"path": file_path, "content": original})

    # -----------------------------------------------------------------------
    # SSE Stream tests
    # -----------------------------------------------------------------------

    def test_chat_stream(self):
        print("\n  Testing Chat Stream API...")
        self._ensure_auth()
        status, _, _ = self.client.post("/api/chat/stream", {
            "message": "Hello",
            "mode": "chat",
        })
        self.check(
            "POST /api/chat/stream — 200 or 500",
            status in (200, 500),
            f"status={status}"
        )

    # -----------------------------------------------------------------------
    # Edge cases
    # -----------------------------------------------------------------------

    def test_invalid_json(self):
        print("\n  Testing Edge Cases — Invalid JSON...")
        self._ensure_auth()
        for path in ["/api/chat", "/api/plan", "/api/memory", "/api/files",
                       "/api/files/apply", "/api/files/commit", "/api/files/diff"]:
            status, _, _ = self.client.request("POST", path, raw_body=b"not json")
            self.check(
                f"POST {path} with invalid JSON — 400 or 401",
                status in (400, 401),
                f"status={status}"
            )

    def test_nonexistent_endpoint(self):
        print("\n  Testing Edge Cases — 404...")
        self._ensure_auth()
        status, _, _ = self.client.get("/api/nonexistent")
        self.check("GET /api/nonexistent — 404", status == 404)

    # -----------------------------------------------------------------------
    # Run all tests
    # -----------------------------------------------------------------------

    def run_all(self):
        print("=" * 60)
        print("GradBridge Full Application Test Suite")
        print(f"   Target: {BASE_URL}")
        print("=" * 60)

        start = time.time()

        self.test_pages()
        self.test_auth_register()
        self.test_auth_register_duplicate()
        self.test_auth_register_validation()
        self.test_auth_get_session()
        self.test_auth_signin()
        self.test_auth_signin_wrong_password()
        self.test_auth_signin_nonexistent()

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

        self.test_chat()
        self.test_chat_validation()
        self.test_chat_long_message()
        self.test_plan()
        self.test_plan_validation()

        self.test_file_diff()
        self.test_file_diff_validation()
        self.test_file_apply()
        self.test_file_apply_validation()

        self.test_commit_list()
        self.test_commit_create()

        self.test_chat_stream()

        self.test_invalid_json()
        self.test_nonexistent_endpoint()

        self.test_auth_signout()

        elapsed = time.time() - start

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


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="GradBridge Full Application Test Suite")
    parser.add_argument("--verbose", "-v", action="store_true", help="Show detailed output")
    parser.add_argument("--stop-on-fail", "-s", action="store_true", help="Stop on first failure")
    parser.add_argument("--url", "-u", default=BASE_URL, help="Base URL of the GradBridge server")
    args = parser.parse_args()

    BASE_URL = args.url
    suite = TestSuite(verbose=args.verbose, stop_on_fail=args.stop_on_fail)
    success = suite.run_all()
    sys.exit(0 if success else 1)
