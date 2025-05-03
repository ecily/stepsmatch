// /utils/sendPushNotification.js
import fetch from 'node-fetch';

export default async function sendPushNotification(token, message) {
  try {
    const payload = {
      to: token,
      sound: 'default',
      ...message
    };

    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    console.log('📤 Push gesendet:', data);
    return data;
  } catch (err) {
    console.error('❌ Fehler beim Push-Versand:', err);
  }
}
