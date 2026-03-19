package controllers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"pokemonshowdown/auth-service/database"
	"pokemonshowdown/auth-service/models"
)

type SaveTeamRequest struct {
	UserID   uint   `json:"user_id" binding:"required"`
	Name     string `json:"name" binding:"required"`
	Format   string `json:"format"`
	TeamData string `json:"team_data" binding:"required"`
}

func SaveTeam(c *gin.Context) {
	var req SaveTeamRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	team := models.UserTeam{
		UserID:   req.UserID,
		Name:     req.Name,
		Format:   req.Format,
		TeamData: req.TeamData,
	}

	if err := database.DB.Create(&team).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save team"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Team saved successfully",
		"team":    team,
	})
}

func GetUserTeams(c *gin.Context) {
	userIDStr := c.Param("userId")
	userID, err := strconv.ParseUint(userIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	var teams []models.UserTeam
	if err := database.DB.Where("user_id = ?", userID).Find(&teams).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve teams"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"teams": teams,
	})
}

func DeleteTeam(c *gin.Context) {
	teamIDStr := c.Param("teamId")
	teamID, err := strconv.ParseUint(teamIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid team ID"})
		return
	}

	if err := database.DB.Delete(&models.UserTeam{}, teamID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete team"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Team deleted successfully",
	})
}
