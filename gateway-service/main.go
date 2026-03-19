package main

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"

	"pokemonshowdown/gateway-service/internal/data"
	"pokemonshowdown/gateway-service/internal/matchmaking"
	"pokemonshowdown/gateway-service/internal/networking"
	"pokemonshowdown/gateway-service/internal/simrpc"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for dev
	},
}

func serveWs(hub *networking.Hub, c *gin.Context) {
	username := c.Query("username")
	if username == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "username is required"})
		return
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Println(err)
		return
	}

	client := &networking.Client{
		Hub:      hub,
		Conn:     conn,
		Send:     make(chan []byte, 256),
		Username: username,
	}
	client.Hub.Register <- client

	go client.WritePump()
	go client.ReadPump()
}

func main() {
	// 1. Init Data & Logging
	// Make sure pokemon db is accessible and postgres is running.
	dsn := "host=localhost user=root password=123456 dbname=pokemon port=5432 sslmode=disable TimeZone=Asia/Shanghai"
	data.InitDB(dsn)

	// 2. Init Networking Hub
	hub := networking.NewHub()
	go hub.Run()

	// 3. Init Matchmaking Service
	mmService := matchmaking.NewMatchmakingService()

	// Handle Matches created by Matchmaking Service
	go func() {
		for match := range mmService.MatchCreated {
			log.Printf("Gateway: Match %s started between %s and %s", match.ID, match.Player1.Username, match.Player2.Username)

			// Request Node.js RPC to create battle
			logs, err := simrpc.CreateBattle(match.ID, match.Format, match.Player1.Username, match.Player2.Username)
			if err != nil {
				log.Printf("Failed to create battle on RPC: %v", err)
				continue
			}

			// Notify both players that the match has started
			matchFoundMsg := networking.GatewayMessage{
				Type:    "match_found",
				Payload: []byte(`{"matchId":"` + match.ID + `"}`),
			}
			matchFoundBytes, _ := json.Marshal(matchFoundMsg)

			if p1Client, ok := match.Player1.Conn.(*networking.Client); ok {
				p1Client.Send <- matchFoundBytes
			}
			if p2Client, ok := match.Player2.Conn.(*networking.Client); ok {
				p2Client.Send <- matchFoundBytes
			}

			// Broadcast initial logs to players
			for _, l := range logs {
				logMsg := networking.GatewayMessage{
					Type:    "battle_log",
					Payload: []byte(`{"logs":["` + l + `"]}`), // simplified, handle properly in real code
				}
				logBytes, _ := json.Marshal(logMsg)
				if p1Client, ok := match.Player1.Conn.(*networking.Client); ok {
					p1Client.Send <- logBytes
				}
				if p2Client, ok := match.Player2.Conn.(*networking.Client); ok {
					p2Client.Send <- logBytes
				}
				log.Printf("[Match %s Log] %s", match.ID, l)
			}

			// Save dummy replay as an example of Data persistence
			dummyReplay := data.Replay{
				ID:      match.ID,
				Format:  match.Format,
				Player1: match.Player1.Username,
				Player2: match.Player2.Username,
				Log:     "Battle started...\n", // In reality, this gets updated incrementally
				Winner:  "",
			}
			result := data.DB.Create(&dummyReplay)
			if result.Error != nil {
				log.Printf("Gateway: Failed to save replay for match %s: %v", match.ID, result.Error)
			} else {
				log.Printf("Gateway: Replay initialized for match %s", match.ID)
			}
		}
	}()

	// Wire Hub messages to Matchmaking and Battle Actions
	hub.OnMessage = func(client *networking.Client, msg *networking.GatewayMessage) {
		switch msg.Type {
		case "join_queue":
			var payload struct {
				Format string `json:"format"`
			}
			if err := json.Unmarshal(msg.Payload, &payload); err == nil {
				// Assume base ELO is 1000 for demo
				player := &matchmaking.Player{
					Username: client.Username,
					Elo:      1000.0,
					Conn:     client,
				}
				mmService.AddPlayer(payload.Format, player)
			}
		case "leave_queue":
			var payload struct {
				Format string `json:"format"`
			}
			if err := json.Unmarshal(msg.Payload, &payload); err == nil {
				mmService.RemovePlayer(payload.Format, client.Username)
			}
		case "battle_action":
			var payload struct {
				MatchID string `json:"matchId"`
				Player  string `json:"player"` // "p1" or "p2"
				Action  string `json:"action"` // e.g. "move 1"
			}
			if err := json.Unmarshal(msg.Payload, &payload); err == nil {
				logs, err := simrpc.SendAction(payload.MatchID, payload.Player, payload.Action)
				if err != nil {
					log.Printf("Failed to send action to RPC: %v", err)
					return
				}
				// In reality, broadcast these logs back to the users in the match via WebSocket
				// We don't have the match object easily accessible here, so we will just broadcast to the sender for demo
				for _, l := range logs {
					logMsg := networking.GatewayMessage{
						Type:    "battle_log",
						Payload: []byte(`{"logs":["` + l + `"]}`),
					}
					logBytes, _ := json.Marshal(logMsg)
					client.Send <- logBytes
					log.Printf("[Match %s Log] %s", payload.MatchID, l)
				}
			}
		}
	}

	// Setup Gin
	r := gin.Default()

	// CORS middleware
	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})

	r.GET("/ws/gateway", func(c *gin.Context) {
		serveWs(hub, c)
	})

	log.Println("Gateway Service running on :8083")
	if err := r.Run(":8083"); err != nil {
		log.Fatal("Failed to start Gateway server:", err)
	}
}
