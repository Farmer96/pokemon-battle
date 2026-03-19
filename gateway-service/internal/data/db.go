package data

import (
	"log"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var DB *gorm.DB

type Replay struct {
	ID        string    `gorm:"primaryKey;type:varchar(255)" json:"id"` // e.g. "gen9ou-123456"
	Format    string    `gorm:"index;type:varchar(50)" json:"format"`
	Player1   string    `gorm:"index;type:varchar(255)" json:"player1"`
	Player2   string    `gorm:"index;type:varchar(255)" json:"player2"`
	Log       string    `gorm:"type:text" json:"log"` // The battle log
	Winner    string    `gorm:"type:varchar(255)" json:"winner"`
	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`
}

type ChatLog struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Room      string    `gorm:"index;type:varchar(50)" json:"room"`
	Sender    string    `gorm:"index;type:varchar(255)" json:"sender"`
	Message   string    `gorm:"type:text" json:"message"`
	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`
}

type ModLog struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Action    string    `gorm:"type:varchar(50)" json:"action"` // e.g. "BAN", "MUTE"
	Moderator string    `gorm:"index;type:varchar(255)" json:"moderator"`
	Target    string    `gorm:"index;type:varchar(255)" json:"target"`
	Reason    string    `gorm:"type:text" json:"reason"`
	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`
}

func InitDB(dsn string) {
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// Auto Migrate
	err = db.AutoMigrate(&Replay{}, &ChatLog{}, &ModLog{})
	if err != nil {
		log.Fatalf("Failed to migrate database: %v", err)
	}

	DB = db
	log.Println("Data & Logging Module: Database connected and migrated.")
}
