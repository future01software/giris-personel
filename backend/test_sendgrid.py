import os
from dotenv import load_dotenv
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, Content

load_dotenv()

def test_send():
    api_key = os.environ.get("SENDGRID_API_KEY")
    mail_from = os.environ.get("MAIL_FROM")
    
    print(f"Using API Key: {api_key[:10]}...")
    print(f"From: {mail_from}")
    
    message = Mail(
        from_email=Email(mail_from, "Clear2Work Test"),
        to_emails=To("ilker.bocek@gmail.com"),
        subject="SendGrid Test Diagnostic",
        html_content=Content("text/html", "<strong>Test working!</strong>")
    )
    
    try:
        sg = SendGridAPIClient(api_key)
        response = sg.send(message)
        print(f"Status Code: {response.status_code}")
        print(f"Body: {response.body}")
        print(f"Headers: {response.headers}")
    except Exception as e:
        print(f"ERROR: {e}")
        if hasattr(e, 'body'):
            print(f"Error Body: {e.body}")

if __name__ == "__main__":
    test_send()
