package main

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"

	"pokemonshowdown/chat-service/internal/chat"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for dev
	},
}

func serveWs(hub *chat.Hub, c *gin.Context) {
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

	client := &chat.Client{
		Hub:      hub,
		Conn:     conn,
		Send:     make(chan []byte, 256),
		Username: username,
		Rooms:    make(map[string]bool),
	}
	client.Hub.Register <- client

	go client.WritePump()
	go client.ReadPump()
}

func main() {
	hub := chat.NewHub()
	go hub.Run()

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

	r.GET("/ws", func(c *gin.Context) {
		serveWs(hub, c)
	})

	log.Println("Chat Service running on :8082")
	if err := r.Run(":8082"); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}
