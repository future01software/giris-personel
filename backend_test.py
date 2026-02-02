import requests
import sys
from datetime import datetime, timedelta
import json

class GateKeeperAPITester:
    def __init__(self, base_url="https://workgate.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.admin_token = None
        self.security_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.created_personnel_id = None
        self.created_doc_type_ids = []
        self.created_doc_ids = []

    def run_test(self, name, method, endpoint, expected_status, data=None, token=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = f'Bearer {token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=data)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return success, response.json()
                except:
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    print(f"Response: {response.text}")
                except:
                    pass
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_admin_login(self):
        """Test admin login"""
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data={"email": "admin@gatekeeper.com", "password": "admin123"}
        )
        if success and 'token' in response:
            self.admin_token = response['token']
            print(f"Admin user: {response.get('user', {}).get('full_name', 'Unknown')}")
            return True
        return False

    def test_security_login(self):
        """Test security login"""
        success, response = self.run_test(
            "Security Login",
            "POST",
            "auth/login",
            200,
            data={"email": "security@gatekeeper.com", "password": "security123"}
        )
        if success and 'token' in response:
            self.security_token = response['token']
            print(f"Security user: {response.get('user', {}).get('full_name', 'Unknown')}")
            return True
        return False

    def test_get_me_admin(self):
        """Test get current user info for admin"""
        success, response = self.run_test(
            "Get Admin Profile",
            "GET",
            "auth/me",
            200,
            token=self.admin_token
        )
        return success

    def test_get_me_security(self):
        """Test get current user info for security"""
        success, response = self.run_test(
            "Get Security Profile",
            "GET",
            "auth/me",
            200,
            token=self.security_token
        )
        return success

    def test_create_personnel(self):
        """Test creating personnel (admin only)"""
        personnel_data = {
            "full_name": "Ahmet Yılmaz",
            "tc_number": "12345678901",
            "company": "ABC İnşaat",
            "phone": "+905551234567",
            "license_plate": "34ABC123"
        }
        success, response = self.run_test(
            "Create Personnel",
            "POST",
            "personnel",
            200,
            data=personnel_data,
            token=self.admin_token
        )
        if success and 'id' in response:
            self.created_personnel_id = response['id']
            print(f"Created personnel ID: {self.created_personnel_id}")
        return success

    def test_get_personnel_list(self):
        """Test getting personnel list"""
        success, response = self.run_test(
            "Get Personnel List",
            "GET",
            "personnel",
            200,
            token=self.admin_token
        )
        if success:
            print(f"Found {len(response)} personnel records")
        return success

    def test_search_personnel(self):
        """Test personnel search"""
        success, response = self.run_test(
            "Search Personnel",
            "GET",
            "personnel/search",
            200,
            data={"q": "Ahmet"},
            token=self.security_token
        )
        if success:
            print(f"Search returned {len(response)} results")
        return success

    def test_get_personnel_detail(self):
        """Test getting personnel detail"""
        if not self.created_personnel_id:
            print("❌ No personnel ID available for detail test")
            return False
            
        success, response = self.run_test(
            "Get Personnel Detail",
            "GET",
            f"personnel/{self.created_personnel_id}",
            200,
            token=self.admin_token
        )
        if success:
            print(f"Personnel: {response.get('personnel', {}).get('full_name', 'Unknown')}")
            print(f"Overall status: {response.get('overall_status', 'Unknown')}")
        return success

    def test_create_document_types(self):
        """Test creating document types"""
        doc_types = [
            {
                "name_tr": "İSG Eğitimi",
                "name_en": "OHS Training",
                "is_mandatory": True,
                "warning_days": 30
            },
            {
                "name_tr": "Sağlık Raporu",
                "name_en": "Health Report",
                "is_mandatory": True,
                "warning_days": 15
            }
        ]
        
        for doc_type in doc_types:
            success, response = self.run_test(
                f"Create Document Type: {doc_type['name_en']}",
                "POST",
                "documents/types",
                200,
                data=doc_type,
                token=self.admin_token
            )
            if success and 'id' in response:
                self.created_doc_type_ids.append(response['id'])
                print(f"Created document type ID: {response['id']}")
        
        return len(self.created_doc_type_ids) == len(doc_types)

    def test_get_document_types(self):
        """Test getting document types"""
        success, response = self.run_test(
            "Get Document Types",
            "GET",
            "documents/types",
            200,
            token=self.admin_token
        )
        if success:
            print(f"Found {len(response)} document types")
        return success

    def test_create_personnel_documents(self):
        """Test creating personnel documents"""
        if not self.created_personnel_id or not self.created_doc_type_ids:
            print("❌ Missing personnel ID or document type IDs")
            return False

        # Create valid document (future expiry)
        future_date = (datetime.now() + timedelta(days=60)).isoformat()
        valid_doc = {
            "personnel_id": self.created_personnel_id,
            "document_type_id": self.created_doc_type_ids[0],
            "expiry_date": future_date,
            "notes": "Valid document for testing"
        }
        
        success1, response1 = self.run_test(
            "Create Valid Document",
            "POST",
            "documents",
            200,
            data=valid_doc,
            token=self.admin_token
        )
        if success1 and 'id' in response1:
            self.created_doc_ids.append(response1['id'])

        # Create expired document (past expiry)
        past_date = (datetime.now() - timedelta(days=10)).isoformat()
        expired_doc = {
            "personnel_id": self.created_personnel_id,
            "document_type_id": self.created_doc_type_ids[1] if len(self.created_doc_type_ids) > 1 else self.created_doc_type_ids[0],
            "expiry_date": past_date,
            "notes": "Expired document for testing"
        }
        
        success2, response2 = self.run_test(
            "Create Expired Document",
            "POST",
            "documents",
            200,
            data=expired_doc,
            token=self.admin_token
        )
        if success2 and 'id' in response2:
            self.created_doc_ids.append(response2['id'])

        return success1 and success2

    def test_entry_decision_approve(self):
        """Test entry approval decision"""
        if not self.created_personnel_id:
            print("❌ No personnel ID available for entry decision test")
            return False
            
        decision_data = {
            "personnel_id": self.created_personnel_id,
            "decision": "approved",
            "reason": "All documents valid"
        }
        
        success, response = self.run_test(
            "Entry Decision - Approve",
            "POST",
            "entry/decision",
            200,
            data=decision_data,
            token=self.security_token
        )
        return success

    def test_entry_decision_reject(self):
        """Test entry rejection decision"""
        if not self.created_personnel_id:
            print("❌ No personnel ID available for entry decision test")
            return False
            
        decision_data = {
            "personnel_id": self.created_personnel_id,
            "decision": "rejected",
            "reason": "Expired health report"
        }
        
        success, response = self.run_test(
            "Entry Decision - Reject",
            "POST",
            "entry/decision",
            200,
            data=decision_data,
            token=self.security_token
        )
        return success

    def test_get_entry_logs(self):
        """Test getting entry logs"""
        success, response = self.run_test(
            "Get Entry Logs",
            "GET",
            "entry/logs",
            200,
            token=self.security_token
        )
        if success:
            print(f"Found {len(response)} entry log records")
        return success

    def test_dashboard_stats(self):
        """Test dashboard statistics"""
        success, response = self.run_test(
            "Get Dashboard Stats",
            "GET",
            "dashboard/stats",
            200,
            token=self.admin_token
        )
        if success:
            stats = response
            print(f"Total Personnel: {stats.get('total_personnel', 0)}")
            print(f"Entries Today: {stats.get('total_entries_today', 0)}")
            print(f"Approved Today: {stats.get('approved_today', 0)}")
            print(f"Rejected Today: {stats.get('rejected_today', 0)}")
        return success

    def test_role_based_access(self):
        """Test role-based access control"""
        # Security user should NOT be able to create personnel
        personnel_data = {
            "full_name": "Test User",
            "tc_number": "98765432109",
            "company": "Test Company"
        }
        
        success, response = self.run_test(
            "Security Role Access Control (Should Fail)",
            "POST",
            "personnel",
            403,  # Should be forbidden
            data=personnel_data,
            token=self.security_token
        )
        return success

    def cleanup_test_data(self):
        """Clean up created test data"""
        print("\n🧹 Cleaning up test data...")
        
        # Delete created documents
        for doc_id in self.created_doc_ids:
            self.run_test(
                f"Delete Document {doc_id}",
                "DELETE",
                f"documents/{doc_id}",
                200,
                token=self.admin_token
            )
        
        # Delete created personnel
        if self.created_personnel_id:
            self.run_test(
                f"Delete Personnel {self.created_personnel_id}",
                "DELETE",
                f"personnel/{self.created_personnel_id}",
                200,
                token=self.admin_token
            )
        
        # Delete created document types
        for doc_type_id in self.created_doc_type_ids:
            self.run_test(
                f"Delete Document Type {doc_type_id}",
                "DELETE",
                f"documents/types/{doc_type_id}",
                200,
                token=self.admin_token
            )

def main():
    print("🚀 Starting GateKeeper Pro API Tests")
    print("=" * 50)
    
    tester = GateKeeperAPITester()
    
    # Authentication tests
    if not tester.test_admin_login():
        print("❌ Admin login failed, stopping tests")
        return 1
    
    if not tester.test_security_login():
        print("❌ Security login failed, stopping tests")
        return 1
    
    # Profile tests
    tester.test_get_me_admin()
    tester.test_get_me_security()
    
    # Personnel management tests (admin only)
    tester.test_create_personnel()
    tester.test_get_personnel_list()
    tester.test_search_personnel()
    tester.test_get_personnel_detail()
    
    # Document type management tests
    tester.test_create_document_types()
    tester.test_get_document_types()
    
    # Personnel document tests
    tester.test_create_personnel_documents()
    
    # Re-check personnel detail after adding documents
    tester.test_get_personnel_detail()
    
    # Entry decision tests
    tester.test_entry_decision_approve()
    tester.test_entry_decision_reject()
    tester.test_get_entry_logs()
    
    # Dashboard tests
    tester.test_dashboard_stats()
    
    # Role-based access control test
    tester.test_role_based_access()
    
    # Cleanup
    tester.cleanup_test_data()
    
    # Print results
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All backend API tests passed!")
        return 0
    else:
        print(f"❌ {tester.tests_run - tester.tests_passed} tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())