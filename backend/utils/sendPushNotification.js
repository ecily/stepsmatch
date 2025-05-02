
// backend/utils/sendPushNotification.js

export async function sendPushNotification(expoPushToken, { title, body, data = {} }) {
    if (!expoPushToken || !expoPushToken.startsWith('ExponentPushToken')) {
      console.warn('❗ Ungültiger Expo Push Token:', expoPushToken);
      return;
    }
  
    const message = {
      to: expoPushToken,
      sound: 'default',
      title,
      body,
      data,
    };
  
    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });
  
      const data = await response.json();
      console.log('📤 Push-Response:', data);
      return data;
    } catch (error) {
      console.error('❌ Fehler beim Senden der Push Notification:', error);
    }
  }
  