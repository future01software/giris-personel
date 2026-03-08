import os
import logging
from fastapi import APIRouter, Depends, HTTPException
from twilio.rest import Client

from app.models import SMSMessage
from app.deps import get_current_user, require_role

router = APIRouter(prefix="/sms", tags=["sms"])

TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN")
TWILIO_PHONE = os.environ.get("TWILIO_PHONE_NUMBER")

twilio_client = None
if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN:
    try:
        twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    except Exception as e:
        logging.warning(f"Twilio initialization failed: {e}")


@router.post("/send")
async def send_sms(sms: SMSMessage, current_user: dict = Depends(get_current_user)):
    await require_role(current_user, ["admin"])

    if not twilio_client:
        raise HTTPException(status_code=503, detail="SMS service not configured")

    try:
        message = twilio_client.messages.create(body=sms.message, from_=TWILIO_PHONE, to=sms.phone)
        return {"message": "SMS sent", "sid": message.sid}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
