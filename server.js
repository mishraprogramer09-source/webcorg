const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();

app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const clients = new Map();

console.log('WebCorg Chat Server Starting...\n');

wss.on('connection', (ws) => {
    console.log('New client connected');
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('Received:', data.type);
            handleMessage(ws, data);
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    });
    
    ws.on('close', () => {
        for (let [clientWs, userData] of clients.entries()) {
            if (clientWs === ws) {
                console.log(userData.name + ' disconnected');
                clients.delete(clientWs);
                broadcast({
                    type: 'user_left',
                    email: userData.email,
                    name: userData.name
                }, ws);
                break;
            }
        }
    });
    
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

function handleMessage(ws, data) {
    switch(data.type) {
        case 'user_join':
            clients.set(ws, {
                name: data.name,
                email: data.email,
                picture: data.picture
            });
            
            console.log(data.name + ' joined (' + data.email + ')');
            
            const usersList = [];
            for (let [clientWs, userData] of clients.entries()) {
                if (clientWs !== ws) {
                    usersList.push(userData);
                }
            }
            
            ws.send(JSON.stringify({
                type: 'users_list',
                users: usersList
            }));
            
            broadcast({
                type: 'user_join',
                name: data.name,
                email: data.email,
                picture: data.picture
            }, ws);
            break;
            
        case 'chat_message':
            for (let [clientWs, userData] of clients.entries()) {
                if (userData.email === data.to) {
                    clientWs.send(JSON.stringify({
                        type: 'chat_message',
                        from: data.from,
                        to: data.to,
                        message: data.message
                    }));
                    console.log('Message from ' + data.from + ' to ' + data.to);
                    break;
                }
            }
            break;
            
        case 'request_users':
            const allUsers = [];
            for (let [clientWs, userData] of clients.entries()) {
                if (clientWs !== ws) {
                    allUsers.push(userData);
                }
            }
            
            ws.send(JSON.stringify({
                type: 'users_list',
                users: allUsers
            }));
            break;
    }
}

function broadcast(data, senderWs) {
    const message = JSON.stringify(data);
    
    for (let [clientWs, userData] of clients.entries()) {
        if (clientWs !== senderWs && clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(message);
        }
    }
}

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log('Server is running on port ' + PORT);
    console.log('WebSocket URL: ws://localhost:' + PORT);
    console.log('HTTP URL: http://localhost:' + PORT);
    console.log('\nWaiting for connections...\n');
});

process.on('SIGINT', () => {
    console.log('\n\nShutting down server...');
    
    for (let [clientWs, userData] of clients.entries()) {
        clientWs.close();
    }
    
    wss.close(() => {
        console.log('WebSocket server closed');
        server.close(() => {
            console.log('HTTP server closed');
            process.exit(0);
        });
    });
});