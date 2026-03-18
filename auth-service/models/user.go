package models

import (
	"time"

	"gorm.io/gorm"
)

type User struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	Username     string    `gorm:"uniqueIndex;not null" json:"username"`
	PasswordHash string    `gorm:"not null" json:"-"`
	Email        string    `json:"email"`
	RegisterTime time.Time `gorm:"autoCreateTime" json:"register_time"`
	Group        int       `gorm:"default:1" json:"group"`
	BanState     int       `gorm:"default:0" json:"ban_state"`
	IP           string    `json:"ip"`
	Avatar       int       `gorm:"default:0" json:"avatar"`
	LoginTime    time.Time `gorm:"autoUpdateTime" json:"login_time"`
	LoginIP      string    `json:"login_ip"`
}

func AutoMigrate(db *gorm.DB) error {
	return db.AutoMigrate(&User{})
}
