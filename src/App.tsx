import React, { useEffect, useState } from "react";
import { Socket, io } from "socket.io-client";

import { QrReader } from "react-qr-reader";

let socket: Socket | null;
let playerId: string;
type Team = "zombies" | "humans";
type GameState = {
  gameOver: boolean;
  players: {
    userId: string;
    team: Team;
    score: number;
    totalScore: number;
  }[];
};

const App = () => {
  const [gameState, setGameState] = useState<GameState>({
    gameOver: false,
    players: [],
  });
  const [updateCounter, forceUpdate] = useState(0);

  useEffect(() => {
    socket = io("https://ws.infect.live");
    socket.on("state", setGameState);

    return () => {
      socket?.close();
    };
  }, [setGameState]);

  const playerInfo = gameState.players.find((p) => p.userId === playerId);

  return (
    <>
      <div
        className="relative h-full w-screen bg-gray-400 overflow-hidden"
        style={{
          minHeight: "-webkit-fill-available",
        }}
      >
        {gameState?.gameOver && (
          <div
            className="absolute w-screen bg-gray-50 z-[70] flex flex-row items-center justify-center text-3xl font-bold"
            style={{
              minHeight: "-webkit-fill-available",
            }}
          >
            GAME
            <br />
            OVER
          </div>
        )}
        <QrReader
          constraints={{ facingMode: "environment" }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onResult={(result) => {
            if (result) {
              const text = result.getText();
              if (!playerId) {
                socket?.emit("join", { userId: text });
                playerId = text;
                forceUpdate((p) => p + 1);
              } else {
                if (text === playerId) return;
                socket?.emit("scan", { userId: playerId, targetId: text });
              }
            }
          }}
          className="min-safe-h-screen"
          containerStyle={{
            position: "fixed",
            width: "100vw",
            height: "100vh",
            backgroundColor: "red",
          }}
          videoStyle={{
            width: "auto",
            maxWidth: "unset",
            backgroundColor: "green",
          }}
          videoContainerStyle={{
            height: "100%",
            backgroundColor: "blue",
          }}
        />
        <div className="absolute bottom-0 left-0 w-full z-[50] bg-yellow-500 flex flex-row justify-center py-2">
          {playerId && !playerInfo && "Loading"}
          {!playerId && <p>Scan your QR to join</p>}
          {playerId && playerInfo && (
            <p className="">
              {playerInfo.team === "zombies" ? "🧟‍♂️" : "🧑‍⚕️"} Score:{" "}
              {playerInfo.score} 🔢 {playerInfo.totalScore}
            </p>
          )}
        </div>
      </div>
    </>
  );
};

export default App;
