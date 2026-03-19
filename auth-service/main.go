package main

import (
	"log"

	"github.com/gin-gonic/gin"

	"pokemonshowdown/auth-service/controllers"
	"pokemonshowdown/auth-service/database"
	"pokemonshowdown/auth-service/models"
)

func main() {
	// Initialize database connection
	database.InitDB()

	// Auto migrate database schemas
	if err := models.AutoMigrate(database.DB); err != nil {
		log.Fatal("Failed to auto migrate database schemas:", err)
	}

	// Initialize Gin router
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

	// Define routes
	api := r.Group("/api/auth")
	{
		api.POST("/register", controllers.Register)
		api.POST("/login", controllers.Login)
	}

	teams := r.Group("/api/teams")
	{
		teams.POST("/", controllers.SaveTeam)
		teams.GET("/user/:userId", controllers.GetUserTeams)
		teams.DELETE("/:teamId", controllers.DeleteTeam)
	}

	// Start server
	log.Println("Auth Service running on :8081")
	if err := r.Run(":8081"); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}
