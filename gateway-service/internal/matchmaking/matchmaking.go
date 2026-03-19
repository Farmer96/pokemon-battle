package matchmaking

import (
	"log"
	"math"
	"sync"
	"time"
)

type Player struct {
	Username string
	Elo      float64
	JoinTime time.Time
	Conn     interface{} // Typically a *networking.Client or channel, simplified here
}

type Match struct {
	ID      string
	Format  string
	Player1 *Player
	Player2 *Player
}

type Ladder struct {
	Format string
	Queue  []*Player
	mu     sync.Mutex
}

type MatchmakingService struct {
	Ladders      map[string]*Ladder
	MatchCreated chan *Match
	mu           sync.Mutex
}

func NewMatchmakingService() *MatchmakingService {
	return &MatchmakingService{
		Ladders:      make(map[string]*Ladder),
		MatchCreated: make(chan *Match, 100),
	}
}

func (m *MatchmakingService) AddPlayer(format string, player *Player) {
	m.mu.Lock()
	if _, exists := m.Ladders[format]; !exists {
		m.Ladders[format] = &Ladder{Format: format, Queue: make([]*Player, 0)}
	}
	ladder := m.Ladders[format]
	m.mu.Unlock()

	ladder.mu.Lock()
	defer ladder.mu.Unlock()

	// Prevent duplicate queueing
	for _, p := range ladder.Queue {
		if p.Username == player.Username {
			return
		}
	}

	// Add player to queue
	player.JoinTime = time.Now()
	ladder.Queue = append(ladder.Queue, player)
	log.Printf("Player %s joined queue for %s. Queue size: %d", player.Username, format, len(ladder.Queue))

	// Trigger match search
	m.findMatch(ladder)
}

func (m *MatchmakingService) RemovePlayer(format string, username string) {
	m.mu.Lock()
	ladder, exists := m.Ladders[format]
	m.mu.Unlock()

	if !exists {
		return
	}

	ladder.mu.Lock()
	defer ladder.mu.Unlock()

	for i, p := range ladder.Queue {
		if p.Username == username {
			// Remove from queue
			ladder.Queue = append(ladder.Queue[:i], ladder.Queue[i+1:]...)
			log.Printf("Player %s left queue for %s. Queue size: %d", username, format, len(ladder.Queue))
			break
		}
	}
}

func (m *MatchmakingService) findMatch(ladder *Ladder) {
	if len(ladder.Queue) < 2 {
		return
	}

	// Simple FIFO matchmaking for now
	// In a real system, you'd match based on Elo proximity expanding over time
	p1 := ladder.Queue[0]
	p2 := ladder.Queue[1]

	// Remove from queue (safely copy the rest to avoid memory leaks)
	newQueue := make([]*Player, len(ladder.Queue)-2)
	copy(newQueue, ladder.Queue[2:])
	ladder.Queue = newQueue

	match := &Match{
		ID:      generateMatchID(ladder.Format),
		Format:  ladder.Format,
		Player1: p1,
		Player2: p2,
	}

	log.Printf("Match created: %s between %s and %s", match.ID, p1.Username, p2.Username)
	m.MatchCreated <- match
}

// CalculateElo updates Elo ratings after a match
// K-factor is typically 32 for normal matches
func CalculateElo(rating1, rating2 float64, p1Won bool) (newR1, newR2 float64) {
	var k float64 = 32.0

	// Expected scores
	e1 := 1.0 / (1.0 + math.Pow(10, (rating2-rating1)/400.0))
	e2 := 1.0 / (1.0 + math.Pow(10, (rating1-rating2)/400.0))

	var s1, s2 float64
	if p1Won {
		s1, s2 = 1.0, 0.0
	} else {
		s1, s2 = 0.0, 1.0
	}

	newR1 = rating1 + k*(s1-e1)
	newR2 = rating2 + k*(s2-e2)

	return newR1, newR2
}

func generateMatchID(format string) string {
	return format + "-" + time.Now().Format("20060102150405")
}
