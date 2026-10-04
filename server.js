const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/categories', require('./routes/categories'));
app.use('/api/parts', require('./routes/parts'));
app.use('/api/models', require('./routes/models'));
app.use('/api/workers', require('./routes/workers'));
app.use('/api/sessions', require('./routes/sessions')(io));
app.use('/api/history', require('./routes/history'));

io.on('connection', (socket) => {
  socket.on('join_session', (sessionId) => {
    socket.join('session_' + sessionId);
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('Server ishga tushdi: http://localhost:' + PORT);
});
