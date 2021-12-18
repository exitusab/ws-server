//JSON Format:
//type
//id
//value
//value2...


const WebSocket = require("ws");
const https = require('https');
const path = require('path');
const fs = require('fs');
const { clearScreenDown } = require("readline");
const { off } = require("process");

const privateKey = fs.readFileSync('ssl-cert/privkey.pem', 'utf8');
const fullchain = fs.readFileSync('ssl-cert/fullchain.pem', 'utf8');

console.log("Starting server on port: 8082");

const credentials = {key: privateKey, cert: fullchain};
const httpsServer = https.createServer(credentials);
httpsServer.listen(8082);

const wss =  new WebSocket.Server({server: httpsServer});

console.log("Server started successfully!");

const MAX_PLAYERS = 16;

const clients = new Array(MAX_PLAYERS);
let lobbyClients = new Array(MAX_PLAYERS);

let isMulti = false;

const unityHostId = 99;
unityConnected = false;

let unityWS = null;


wss.on("connection", (ws, request) =>{

    Lobby(ws);

    ws.on("message", message =>{
        
        try
        {
            if(JSON.parse(message).type == "disconnect")
            {
                ClientLeaves(ws, message);
            }
        } 
        catch(e)
        {
            console.log(`Something went wrong: ${e.data}`);
        }

        if(unityConnected)
        {
            try
            {
                const data = JSON.parse(message);

                if(data.type == "join")
                {
                    NewConnection(ws, data);
                }



                if(data.type == "unityDisconnect")
                {
                    UnityReset();
                }

                if(data.type == "startGame")
                {
                    unityWS.send(JSON.stringify({
                        "id": data.id,
                        "type": "startGame",
                        "value": 0,
                        "value2": 0
                    }));
                    console.log("Start Game");

                    SendToOthers(ws, data);
                }

                if(data.type == "moveRight")
                {
                    unityWS.send(JSON.stringify({
                        "id": data.id,
                        "type": "moveRight",
                        "value": data.value,
                        "value2": 0
                    }));
                }

                if(data.type == "moveLeft")
                {
                    unityWS.send(JSON.stringify({
                        "id": data.id,
                        "type": "moveLeft",
                        "value": data.value,
                        "value2": 0
                    }));
                }

                if(data.type == "gameOver")
                {
                    SendToAll(data);
                    console.log(`Game Over! Your score was: ${data.value}`);
                }
                if(data.type == "rollingScore")
                {
                    //SendToAll(data);
                    //console.log(`Score: ${data.value}`);
                }
                if(data.type == "username")
                {
                    unityWS.send(JSON.stringify({
                        "id": data.id,
                        "type": "username",
                        "value": 0,
                        "value2": 0,
                        "value3": data.value3
                    }));
                    console.log(data.value3);
                }

                
                
    
            } 
            catch(e)
            {
                console.log(`Something went wrong: ${e.data}`);
            }
        }
        else
        {
            UnityConnect(ws, message, request);
        }
    })

    ws.on("close", () =>{
        console.log("Client disconnected");
        ClientLeaves(ws, null);
    })
})


function UnityConnect(ws, message)
{   
    const data = JSON.parse(message)


    if(data.id == 99 && data.type == "unityConnect")
    {
        unityConnected = true;
        console.log("Unity connected!");
        unityWS = ws;

        console.log(`Multi: ${data.multi}`);
        isMulti = data.multi;

        lobbyClients.forEach(c => {
            c.connection.send(JSON.stringify({
                type: "unityConnection",
                value: unityConnected,
                multi: data.multi
            }));
        })
        lobbyClients = new Array(MAX_PLAYERS);
    }
    else{
        console.log("Unity not connected, try again!")
    }
    
    
}

function NewConnection(ws, data)
{
    //console.log(data.value);
    if(ws == unityWS){ return}
    newId = null;

    for (let i = 0; i < MAX_PLAYERS; i++)
    {
        //console.log(clients[i]);
        if (clients[i] != null && clients[i].username == data.value)
        {
            ws.send(JSON.stringify({
                "type": "usernameError",
                "value": "Username already taken!"        
            }))
            return;
        } 
    } 

    for (let i = 0; i < MAX_PLAYERS; i++) 
    {
        if(clients[i] == null)
        {
            //console.log(i);
            newId = i;
            var client = {
                "connection": ws,
                "id": newId,
                "username": data.value};
            clients[newId] = client

            console.log(`New connection from user: ${data.value}`)

            unityWS.send(JSON.stringify({
                "type": "newUser",
                "id": newId,
                "value3": data.value
            }));
            break;
        }
    }
    if(newId != null)
    {

        //send id to player joinging
        ws.send(JSON.stringify({
            type: "join",
            value: newId,
            value2: unityConnected
        }))

        //send new player id to all other clients
        clients.forEach(c => {
            if(c != null && c.connection != ws)
            {
                c.connection.send(JSON.stringify({
                    type: "newPlayer",
                    value: newId
                }))
            }
        });
    }
    else
    {
        console.log("Maximum number of players in game!");
    }
    
}

function ClientLeaves(ws, message)
{
    let j = 0;
    const data = JSON.parse(message);
    clients.forEach(c => {
        if(c != null && c.connection == ws)
        {
            j = c.id
            console.log(`Player number ${j} has left the server`);
            clients[c.id] = null;
            if(unityWS != null)
            {
                unityWS.send(JSON.stringify({
                    "id": j,
                    "type": "disconnect",
                    "value": 0,
                    "value2": 0,
                    "value3": ""
                }))
            }
        }
    });
    lobbyClients.forEach(c => {
        if(c != null && c.connection == ws)
        {
            clients[c.id] = null;
        }
    });

    
    
    
}

function Lobby(ws)
{
    for (let i = 0; i < MAX_PLAYERS; i++) 
    {
        if(lobbyClients[i] == null)
        {
            var client = {
                "connection": ws};
            lobbyClients[i] = client;
            break;
        }
    }

    lobbyClients.forEach(c => {
        if(c != null)
        {
            c.connection.send(JSON.stringify({
                "type": "init",
                "value": unityConnected
            })) 
        }
           
        
    }) ;
}


function UnityReset()
{
    console.log("Lost connection!")
    clients.forEach(c => {
        if(c != null)
        {
            c.connection.send(JSON.stringify({
                type: "unityDisconnect"
            }))
        }
    });
    unityConnected = false;
    unityWS = null;

}



function SendToAll(data)
{
    clients.forEach(c => {
        if(c != null)
        {
            c.connection.send(JSON.stringify({
                "type": data.type,
                "value": data.value
            }))
        }
    });
}

function SendToOthers(ws, data)
{
    clients.forEach(c => {
        if(c != null && c.connection != ws)
        {
            c.connection.send(JSON.stringify({
                "id": data.id,
                "type": "startMulti",
                "value": data.value
            }))
        }
    });
}
