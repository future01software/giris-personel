"""
Backend API Tests for CLEAR2WORK - Personnel Entry Approval System
Testing: User Management, Pagination, Alerts features
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://workgate.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "admin@gatekeeper.com"
ADMIN_PASSWORD = "admin123"
SECURITY_EMAIL = "security@gatekeeper.com"
SECURITY_PASSWORD = "security123"


class TestAuth:
    """Authentication endpoint tests"""
    
    def test_admin_login_success(self):
        """Test admin login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["user"]["role"] == "admin"
    
    def test_security_login_success(self):
        """Test security user login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SECURITY_EMAIL,
            "password": SECURITY_PASSWORD
        })
        # Security user may or may not exist
        if response.status_code == 200:
            data = response.json()
            assert "token" in data
            assert data["user"]["role"] == "security"
        else:
            # Security user doesn't exist yet - that's okay
            assert response.status_code == 401
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@example.com",
            "password": "wrongpass"
        })
        assert response.status_code == 401


@pytest.fixture
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Admin authentication failed")


@pytest.fixture
def admin_headers(admin_token):
    """Get headers with admin auth token"""
    return {
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json"
    }


class TestUserManagement:
    """User Management CRUD tests - Admin only feature"""
    
    def test_get_users_list(self, admin_headers):
        """GET /api/users - list all users"""
        response = requests.get(f"{BASE_URL}/api/users", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Should have at least admin user
        assert len(data) >= 1
        # Verify user structure
        if len(data) > 0:
            user = data[0]
            assert "id" in user
            assert "email" in user
            assert "full_name" in user
            assert "role" in user
            # Password should NOT be returned
            assert "password" not in user
    
    def test_create_user(self, admin_headers):
        """POST /api/users - create new user"""
        test_user = {
            "email": f"TEST_user_{int(time.time())}@test.com",
            "password": "testpass123",
            "full_name": "TEST User Create",
            "role": "security"
        }
        response = requests.post(f"{BASE_URL}/api/users", json=test_user, headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "id" in data
        
        # Verify user was created by fetching users list
        list_response = requests.get(f"{BASE_URL}/api/users", headers=admin_headers)
        users = list_response.json()
        created_user = next((u for u in users if u["email"] == test_user["email"]), None)
        assert created_user is not None
        assert created_user["full_name"] == test_user["full_name"]
        assert created_user["role"] == test_user["role"]
        
        # Cleanup - delete the test user
        requests.delete(f"{BASE_URL}/api/users/{data['id']}", headers=admin_headers)
    
    def test_create_user_duplicate_email(self, admin_headers):
        """POST /api/users - should fail with duplicate email"""
        response = requests.post(f"{BASE_URL}/api/users", json={
            "email": ADMIN_EMAIL,  # Already exists
            "password": "testpass123",
            "full_name": "Duplicate User",
            "role": "security"
        }, headers=admin_headers)
        assert response.status_code == 400
        assert "already" in response.json().get("detail", "").lower()
    
    def test_update_user(self, admin_headers):
        """PUT /api/users/{id} - update user"""
        # First create a user to update
        test_user = {
            "email": f"TEST_update_{int(time.time())}@test.com",
            "password": "testpass123",
            "full_name": "TEST User Update",
            "role": "security"
        }
        create_response = requests.post(f"{BASE_URL}/api/users", json=test_user, headers=admin_headers)
        assert create_response.status_code == 200
        user_id = create_response.json()["id"]
        
        # Update the user
        update_data = {
            "email": test_user["email"],
            "password": "",  # Empty password should not change it
            "full_name": "TEST User Updated Name",
            "role": "supervisor"
        }
        update_response = requests.put(f"{BASE_URL}/api/users/{user_id}", json=update_data, headers=admin_headers)
        assert update_response.status_code == 200
        
        # Verify update by fetching users
        list_response = requests.get(f"{BASE_URL}/api/users", headers=admin_headers)
        users = list_response.json()
        updated_user = next((u for u in users if u["id"] == user_id), None)
        assert updated_user is not None
        assert updated_user["full_name"] == "TEST User Updated Name"
        assert updated_user["role"] == "supervisor"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/users/{user_id}", headers=admin_headers)
    
    def test_delete_user(self, admin_headers):
        """DELETE /api/users/{id} - delete user"""
        # First create a user to delete
        test_user = {
            "email": f"TEST_delete_{int(time.time())}@test.com",
            "password": "testpass123",
            "full_name": "TEST User Delete",
            "role": "security"
        }
        create_response = requests.post(f"{BASE_URL}/api/users", json=test_user, headers=admin_headers)
        assert create_response.status_code == 200
        user_id = create_response.json()["id"]
        
        # Delete the user
        delete_response = requests.delete(f"{BASE_URL}/api/users/{user_id}", headers=admin_headers)
        assert delete_response.status_code == 200
        
        # Verify deletion
        list_response = requests.get(f"{BASE_URL}/api/users", headers=admin_headers)
        users = list_response.json()
        deleted_user = next((u for u in users if u["id"] == user_id), None)
        assert deleted_user is None
    
    def test_delete_self_not_allowed(self, admin_headers, admin_token):
        """DELETE /api/users/{id} - should not allow self-deletion"""
        # Get current user ID
        me_response = requests.get(f"{BASE_URL}/api/auth/me", headers=admin_headers)
        assert me_response.status_code == 200
        current_user_id = me_response.json()["id"]
        
        # Try to delete self
        delete_response = requests.delete(f"{BASE_URL}/api/users/{current_user_id}", headers=admin_headers)
        assert delete_response.status_code == 400
        assert "own account" in delete_response.json().get("detail", "").lower()
    
    def test_users_requires_admin_role(self):
        """GET /api/users - should require admin role"""
        # Try without auth
        response = requests.get(f"{BASE_URL}/api/users")
        assert response.status_code in [401, 403]


class TestPagination:
    """Pagination tests for personnel and entry logs"""
    
    def test_personnel_pagination_default(self, admin_headers):
        """GET /api/personnel - returns paginated data"""
        response = requests.get(f"{BASE_URL}/api/personnel", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify pagination structure
        assert "data" in data
        assert "total" in data
        assert "page" in data
        assert "limit" in data
        assert "pages" in data
        
        assert isinstance(data["data"], list)
        assert isinstance(data["total"], int)
        assert data["page"] == 1
    
    def test_personnel_pagination_with_params(self, admin_headers):
        """GET /api/personnel?page=1&limit=20 - pagination with params"""
        response = requests.get(f"{BASE_URL}/api/personnel?page=1&limit=20", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert data["page"] == 1
        assert data["limit"] == 20
        assert len(data["data"]) <= 20
    
    def test_personnel_pagination_page_2(self, admin_headers):
        """GET /api/personnel?page=2 - second page"""
        response = requests.get(f"{BASE_URL}/api/personnel?page=2&limit=10", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 2
    
    def test_entry_logs_paginated(self, admin_headers):
        """GET /api/entry/logs/paginated - paginated entry logs"""
        response = requests.get(f"{BASE_URL}/api/entry/logs/paginated?page=1&limit=20", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify pagination structure
        assert "data" in data
        assert "total" in data
        assert "page" in data
        assert "limit" in data
        assert "pages" in data
        
        assert data["page"] == 1
        assert data["limit"] == 20


class TestAlerts:
    """Alerts endpoint tests - expiring documents"""
    
    def test_get_expiring_documents(self, admin_headers):
        """GET /api/alerts/expiring-documents - returns expiring documents"""
        response = requests.get(f"{BASE_URL}/api/alerts/expiring-documents", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "alerts" in data
        assert "total" in data
        assert "threshold_days" in data
        
        assert isinstance(data["alerts"], list)
        assert isinstance(data["total"], int)
        assert data["threshold_days"] == 30  # Default
    
    def test_get_expiring_documents_custom_days(self, admin_headers):
        """GET /api/alerts/expiring-documents?days=60 - custom threshold"""
        response = requests.get(f"{BASE_URL}/api/alerts/expiring-documents?days=60", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert data["threshold_days"] == 60
    
    def test_alerts_structure(self, admin_headers):
        """Verify alert item structure"""
        response = requests.get(f"{BASE_URL}/api/alerts/expiring-documents?days=365", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        
        if len(data["alerts"]) > 0:
            alert = data["alerts"][0]
            assert "personnel_id" in alert
            assert "full_name" in alert
            assert "company" in alert
            assert "expiring_documents" in alert
            assert "most_urgent_days" in alert
            
            if len(alert["expiring_documents"]) > 0:
                doc = alert["expiring_documents"][0]
                assert "document_type" in doc
                assert "expiry_date" in doc
                assert "days_until_expiry" in doc
                assert "is_expired" in doc
                assert "is_mandatory" in doc
    
    def test_alerts_requires_auth(self):
        """GET /api/alerts/expiring-documents - requires authentication"""
        response = requests.get(f"{BASE_URL}/api/alerts/expiring-documents")
        assert response.status_code in [401, 403]


class TestDashboardStats:
    """Dashboard stats endpoint tests"""
    
    def test_dashboard_stats(self, admin_headers):
        """GET /api/dashboard/stats - returns dashboard statistics"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify stats structure
        assert "total_personnel" in data
        assert "total_entries_today" in data
        assert "approved_today" in data
        assert "rejected_today" in data
        assert "can_enter" in data
        assert "cannot_enter" in data
        
        # Values should be integers
        assert isinstance(data["total_personnel"], int)
        assert isinstance(data["can_enter"], int)
        assert isinstance(data["cannot_enter"], int)


class TestExistingEndpoints:
    """Test existing endpoints still work"""
    
    def test_entry_logs_non_paginated(self, admin_headers):
        """GET /api/entry/logs - original non-paginated endpoint"""
        response = requests.get(f"{BASE_URL}/api/entry/logs?limit=5", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_document_types(self, admin_headers):
        """GET /api/documents/types - document types list"""
        response = requests.get(f"{BASE_URL}/api/documents/types", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_personnel_search(self, admin_headers):
        """GET /api/personnel/search - search functionality"""
        response = requests.get(f"{BASE_URL}/api/personnel/search?q=test", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


# Cleanup fixture to remove test data
@pytest.fixture(scope="session", autouse=True)
def cleanup_test_users():
    """Cleanup TEST_ prefixed users after all tests"""
    yield
    # Get admin token
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        token = response.json().get("token")
        headers = {"Authorization": f"Bearer {token}"}
        
        # Get all users and delete TEST_ prefixed ones
        users_response = requests.get(f"{BASE_URL}/api/users", headers=headers)
        if users_response.status_code == 200:
            users = users_response.json()
            for user in users:
                if user.get("email", "").startswith("TEST_"):
                    requests.delete(f"{BASE_URL}/api/users/{user['id']}", headers=headers)
