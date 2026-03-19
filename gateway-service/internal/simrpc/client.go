package simrpc

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

const rpcURL = "http://localhost:8084/api/battle"

type CreateBattleReq struct {
	MatchID  string `json:"matchId"`
	FormatID string `json:"formatId"`
	P1       Player `json:"p1"`
	P2       Player `json:"p2"`
}

type Player struct {
	Name string `json:"name"`
}

type BattleActionReq struct {
	MatchID string `json:"matchId"`
	Player  string `json:"player"` // "p1" or "p2"
	Action  string `json:"action"` // e.g. "move 1", "switch 2"
}

type RpcResponse struct {
	MatchID string   `json:"matchId"`
	Logs    []string `json:"logs"`
	Error   string   `json:"error"`
}

var client = &http.Client{Timeout: 5 * time.Second}

func CreateBattle(matchID, formatID, p1Name, p2Name string) ([]string, error) {
	reqData := CreateBattleReq{
		MatchID:  matchID,
		FormatID: formatID,
		P1:       Player{Name: p1Name},
		P2:       Player{Name: p2Name},
	}

	return sendRequest("/create", reqData)
}

func SendAction(matchID, player, action string) ([]string, error) {
	reqData := BattleActionReq{
		MatchID: matchID,
		Player:  player,
		Action:  action,
	}

	return sendRequest("/action", reqData)
}

func sendRequest(endpoint string, data interface{}) ([]string, error) {
	body, err := json.Marshal(data)
	if err != nil {
		return nil, err
	}

	resp, err := client.Post(rpcURL+endpoint, "application/json", bytes.NewBuffer(body))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var rpcResp RpcResponse
	if err := json.NewDecoder(resp.Body).Decode(&rpcResp); err != nil {
		return nil, err
	}

	if rpcResp.Error != "" {
		return nil, fmt.Errorf("rpc error: %s", rpcResp.Error)
	}

	return rpcResp.Logs, nil
}
