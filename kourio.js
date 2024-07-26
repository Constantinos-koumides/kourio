
const express = require('express');
const { google } = require('googleapis');
const bodyParser = require('body-parser');
const app = express();
app.use(bodyParser.json());

const oAuth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URI
);

oAuth2Client.setCredentials({ refresh_token: process.env.REFRESH_TOKEN });

const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });

app.get('/available-slots', async (req, res) => {
  const { calendarId, timeMin, timeMax } = req.query;
  try {
    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin,
        timeMax,
        items: [{ id: calendarId }]
      }
    });
    const busySlots = response.data.calendars[calendarId].busy;
    const availableSlots = getAvailableSlots(busySlots, timeMin, timeMax);
    res.json(availableSlots);
  } catch (error) {
    res.status(500).send(error);
  }
});

const getAvailableSlots = (busySlots, timeMin, timeMax) => {
  const slots = [];
  let start = new Date(timeMin);
  const end = new Date(timeMax);
  
  while (start < end) {
    const nextSlot = new Date(start.getTime() + 10 * 60000);
    const isBusy = busySlots.some(busySlot => {
      const busyStart = new Date(busySlot.start);
      const busyEnd = new Date(busySlot.end);
      return (start >= busyStart && start < busyEnd) || (nextSlot > busyStart && nextSlot <= busyEnd);
    });

    if (!isBusy) {
      slots.push({ start: start.toISOString(), end: nextSlot.toISOString() });
    }

    start = nextSlot;
  }

  return slots;
};

app.post('/book-appointment', async (req, res) => {
  const { calendarId, start, end, summary } = req.body;
  const event = {
    summary,
    start: { dateTime: start },
    end: { dateTime: end }
  };
  try {
    const response = await calendar.events.insert({
      calendarId,
      requestBody: event
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).send(error);
  }
});

