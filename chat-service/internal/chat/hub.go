package chat

import (
	"encoding/json"
	"log"
	"sync"
)

type Message struct {
	Type      string `json:"type"`   // "chat", "pm", "join", "leave", "room_list", "users_update"
	Room      string `json:"room"`   // target room name
	Sender    string `json:"sender"` // username
	Target    string `json:"target"` // for pm
	Content   string `json:"content"`
	Timestamp int64  `json:"timestamp"`
}

type Hub struct {
	// Registered clients.
	Clients map[*Client]bool

	// Users by username (for private messages)
	Users map[string]*Client

	// Rooms map[roomName]map[*Client]bool
	Rooms map[string]map[*Client]bool

	// Inbound messages from the clients.
	Broadcast chan *Message

	// Register requests from the clients.
	Register chan *Client

	// Unregister requests from clients.
	Unregister chan *Client

	mu sync.RWMutex
}

func NewHub() *Hub {
	return &Hub{
		Broadcast:  make(chan *Message),
		Register:   make(chan *Client),
		Unregister: make(chan *Client),
		Clients:    make(map[*Client]bool),
		Users:      make(map[string]*Client),
		Rooms:      make(map[string]map[*Client]bool),
	}
}

func (h *Hub) Run() {
	// Initialize default lobby
	h.Rooms["lobby"] = make(map[*Client]bool)

	for {
		select {
		case client := <-h.Register:
			h.mu.Lock()

			// Kick existing user if already logged in
			if client.Username != "" {
				if oldClient, exists := h.Users[client.Username]; exists {
					// Notify old client that they are being kicked
					kickMsg := &Message{
						Type:    "kick",
						Sender:  "System",
						Content: "您的账号已在其他地方登录",
					}
					kickBytes, _ := json.Marshal(kickMsg)
					select {
					case oldClient.Send <- kickBytes:
					default:
					}

					// Remove old client
					delete(h.Clients, oldClient)
					for room := range oldClient.Rooms {
						if _, ok := h.Rooms[room]; ok {
							delete(h.Rooms[room], oldClient)
						}
					}
					close(oldClient.Send)
				}
				h.Users[client.Username] = client
			}

			h.Clients[client] = true

			// Auto join lobby
			h.Rooms["lobby"][client] = true
			client.Rooms["lobby"] = true

			// We can't broadcast while holding the lock if broadcast takes time or channel blocks?
			// The channels are buffered in client, so it should be fine.
			// But let's unlock first to be safe and avoid deadlock if broadcast tries to lock (it does lock RLock).
			h.mu.Unlock()

			// Broadcast join
			joinMsg := &Message{
				Type:    "join",
				Room:    "lobby",
				Sender:  "System",
				Content: client.Username + " 加入了大厅。",
			}
			h.BroadcastToRoom("lobby", joinMsg)
			h.broadcastUserList()

			// Send current user list to the new client immediately
			// The client might miss the broadcastUserList if it hasn't started reading yet.
			// Actually broadcastUserList sends to all clients in "lobby".
			// Since we added client to lobby above, it should receive it.
			// BUT, the channel might be processed concurrently.
			// Let's explicitly send a users_update to the newly connected client.
			h.mu.RLock()
			users := make([]string, 0, len(h.Users))
			for u := range h.Users {
				users = append(users, u)
			}
			h.mu.RUnlock()

			msgBytes, _ := json.Marshal(users)
			initMsg := &Message{
				Type:    "users_update",
				Content: string(msgBytes),
			}
			initMsgBytes, _ := json.Marshal(initMsg)

			// Send directly to the new client without waiting for broadcast
			select {
			case client.Send <- initMsgBytes:
			default:
			}

		case client := <-h.Unregister:
			h.mu.Lock()
			if _, ok := h.Clients[client]; ok {
				delete(h.Clients, client)
				if client.Username != "" {
					delete(h.Users, client.Username)
				}
				for room := range client.Rooms {
					if _, ok := h.Rooms[room]; ok {
						delete(h.Rooms[room], client)
					}
				}
				close(client.Send)
			}
			h.mu.Unlock()

			leaveMsg := &Message{
				Type:    "leave",
				Room:    "lobby",
				Sender:  "System",
				Content: client.Username + " 离开了。",
			}
			h.BroadcastToRoom("lobby", leaveMsg)
			h.broadcastUserList()

		case message := <-h.Broadcast:
			if message.Type == "pm" {
				h.sendPrivateMessage(message)
			} else {
				h.BroadcastToRoom(message.Room, message)
			}
		}
	}
}

func (h *Hub) BroadcastToRoom(room string, msg *Message) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	roomClients, ok := h.Rooms[room]
	if !ok {
		return
	}

	msgBytes, err := json.Marshal(msg)
	if err != nil {
		log.Println("Error marshalling message:", err)
		return
	}

	for client := range roomClients {
		select {
		case client.Send <- msgBytes:
		default:
			close(client.Send)
			delete(roomClients, client)
			delete(h.Clients, client)
		}
	}
}

func (h *Hub) sendPrivateMessage(msg *Message) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	targetClient, ok := h.Users[msg.Target]
	if !ok {
		return
	}

	msgBytes, err := json.Marshal(msg)
	if err != nil {
		return
	}

	select {
	case targetClient.Send <- msgBytes:
	default:
		close(targetClient.Send)
		delete(h.Users, targetClient.Username)
		delete(h.Clients, targetClient)
	}

	// Also send back to sender so they see it
	senderClient, ok := h.Users[msg.Sender]
	if ok && senderClient != targetClient {
		senderClient.Send <- msgBytes
	}
}

func (h *Hub) broadcastUserList() {
	h.mu.RLock()
	users := make([]string, 0, len(h.Users))
	for u := range h.Users {
		users = append(users, u)
	}
	h.mu.RUnlock()

	msg := &Message{
		Type:    "users_update",
		Content: "",
	}
	// We use Content to pass JSON string of users for simplicity
	msgBytes, _ := json.Marshal(users)
	msg.Content = string(msgBytes)

	h.BroadcastToRoom("lobby", msg)
}
