package networking

import (
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 5120
)

type GatewayMessage struct {
	Type    string          `json:"type"` // e.g. "chat", "join_queue", "leave_queue", "ping"
	Payload json.RawMessage `json:"payload"`
}

type Client struct {
	Hub      *Hub
	Conn     *websocket.Conn
	Send     chan []byte
	Username string
}

func (c *Client) ReadPump() {
	defer func() {
		c.Hub.Unregister <- c
		c.Conn.Close()
	}()

	c.Conn.SetReadLimit(maxMessageSize)
	c.Conn.SetReadDeadline(time.Now().Add(pongWait))
	// Heartbeat: When we receive a pong, reset the read deadline
	c.Conn.SetPongHandler(func(string) error { 
		c.Conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil 
	})

	for {
		_, messageBytes, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("error: %v", err)
			}
			break
		}

		var msg GatewayMessage
		if err := json.Unmarshal(messageBytes, &msg); err != nil {
			continue
		}

		// Handle messages (e.g. forward to matchmaking or chat)
		c.Hub.HandleMessage(c, &msg)
	}
}

func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.Conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			if err := w.Close(); err != nil {
				return
			}
		case <-ticker.C:
			// Heartbeat: Send ping periodically
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

type Hub struct {
	Clients    map[*Client]bool
	Users      map[string]*Client
	Register   chan *Client
	Unregister chan *Client
	mu         sync.RWMutex

	// Callback for handling specific messages like "join_queue"
	OnMessage func(client *Client, msg *GatewayMessage)
}

func NewHub() *Hub {
	return &Hub{
		Register:   make(chan *Client),
		Unregister: make(chan *Client),
		Clients:    make(map[*Client]bool),
		Users:      make(map[string]*Client),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.Register:
			h.mu.Lock()
			if client.Username != "" {
				// Kick existing connection
				if oldClient, exists := h.Users[client.Username]; exists {
					close(oldClient.Send)
					delete(h.Clients, oldClient)
				}
				h.Users[client.Username] = client
			}
			h.Clients[client] = true
			h.mu.Unlock()
			log.Printf("Networking: Client connected: %s", client.Username)

		case client := <-h.Unregister:
			h.mu.Lock()
			if _, ok := h.Clients[client]; ok {
				delete(h.Clients, client)
				if client.Username != "" {
					delete(h.Users, client.Username)
				}
				close(client.Send)
			}
			h.mu.Unlock()
			log.Printf("Networking: Client disconnected: %s", client.Username)
		}
	}
}

func (h *Hub) HandleMessage(c *Client, msg *GatewayMessage) {
	if h.OnMessage != nil {
		h.OnMessage(c, msg)
	}
}
