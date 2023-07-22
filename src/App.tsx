import { useEffect, useMemo, useState } from "react";
import { Socket, io } from "socket.io-client";

import { QrReader } from "react-qr-reader";

let socket: Socket | null;
type Team = "zombies" | "humans";
type GameState = {
  gameOver: boolean;
  gameId: number;
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
    gameId: 0,
  });
  const [hasScannedRecently, setHasScannedRecently] = useState(false);
  const [isScanTimeout, setIsScanTimeout] = useState(false);
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const timeout = setTimeout(() => setIsScanTimeout(false), 2000);

    return () => {
      clearTimeout(timeout);
    };
  }, [isScanTimeout]);

  useEffect(() => {
    const timeout = setTimeout(() => setHasScannedRecently(false), 150);

    return () => {
      clearTimeout(timeout);
    };
  }, [hasScannedRecently]);

  useEffect(() => {
    socket = io("https://ws.infect.live");
    socket.on("state", (state) => {
      setGameState((g) => {
        if (state.gameId === g.gameId || g.gameId === 0) {
          return state;
        }
        return g;
      });
    });

    return () => {
      socket?.close();
    };
  }, [setGameState, gameState]);

  const playerId = localStorage.getItem("playerId");

  const playerInfo = gameState.players.find((p) => p.userId === playerId);

  const qrReader = useMemo(() => {
    return (
      <QrReader
        constraints={{ facingMode: "environment" }}
        onResult={(result) => {
          if (isScanTimeout) return;
          if (result) {
            const text = result.getText();
            setHasScannedRecently(true);
            setIsScanTimeout(true);
            if (!localStorage.getItem("playerId")) {
              socket?.emit("join", { userId: text });
              localStorage.setItem("playerId", text);

              forceUpdate((p) => p + 1);
            } else {
              if (text === localStorage.getItem("playerId")) return;
              socket?.emit("scan", {
                userId: localStorage.getItem("playerId"),
                targetId: text,
              });
            }
          }
        }}
        className="min-safe-h-screen"
        containerStyle={{
          position: "fixed",
          width: "100vw",
          height: "100vh",
        }}
        videoStyle={{
          width: "auto",
          maxWidth: "unset",
        }}
        videoContainerStyle={{
          height: "100%",
        }}
      />
    );
  }, [isScanTimeout, setHasScannedRecently, setIsScanTimeout]);

  return (
    <>
      <div className="relative bg-gray-900 h-full w-screen overflow-hidden min-safe-h-screen">
        {gameState?.gameOver && (
          <div className="absolute w-screen bg-gray-50 z-[70] flex flex-col items-center justify-center min-safe-h-screen gap-4">
            <p className="text-3xl font-bold">
              GAME
              <br />
              OVER
            </p>
            <p className="">
              {playerInfo?.team === "zombies" ? "🧟‍♂️" : "🧑‍⚕️"} Score:{" "}
              {playerInfo?.score} 🔢 {playerInfo?.totalScore}
            </p>
            <div
              className="bg-blue-500 p-2 rounded-md text-white font-semibold text-xl"
              onClick={() => {
                setGameState({
                  gameOver: false,
                  players: [],
                  gameId: 0,
                });

                socket?.emit("join", {
                  userId: localStorage.getItem("playerId"),
                });
              }}
            >
              Join new game
            </div>
          </div>
        )}

        <div
          className="absolute w-screen pointer-events-none transition-opacity ease-in-out delay-100 bg-gray-50 z-[70] min-safe-h-screen"
          style={{ opacity: hasScannedRecently ? 1 : 0 }}
        >
          &nbsp;
        </div>
        {qrReader}
        <div className="absolute top-0 left-0 w-full p-8 z-[50] flex flex-row justify-center py-2 bg-yellow-500">
          {localStorage.getItem("playerId") && !playerInfo && "Loading"}
          {!localStorage.getItem("playerId") && <p>Scan your QR to join</p>}
          {localStorage.getItem("playerId") && playerInfo && (
            <span className="w-full flex flex-row justify-between items-center">
              &nbsp;
              <p className="">
                {playerInfo.team === "zombies" ? "🧟‍♂️" : "🧑‍⚕️"} Score:{" "}
                {playerInfo.score} 🔢 {playerInfo.totalScore}
              </p>
              <div
                className="bg-red-100 p-2 rounded-sm"
                onClick={() => {
                  socket?.emit("leave", {
                    userId: localStorage.getItem("playerId"),
                  });
                  localStorage.removeItem("playerId");
                }}
              >
                <p>Leave</p>
              </div>
            </span>
          )}
        </div>
      </div>
    </>
  );
};

export default App;
