import { useEffect, useMemo, useRef, useState } from "react";

import Quagga from "@ericblade/quagga2";

import { Socket, io } from "socket.io-client";
import Scanner from "./Scanner";
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

  const [message, setMessage] = useState("");
  const [hasScannedRecently, setHasScannedRecently] = useState(false);
  const [isScanTimeout, setIsScanTimeout] = useState(false);

  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const timeout = setTimeout(() => setIsScanTimeout(false), 100);

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
    const timeout = setTimeout(() => setMessage(""), 1500);

    return () => {
      clearTimeout(timeout);
    };
  }, [message]);

  useEffect(() => {
    socket = io("https://ws.infect.live");
    socket.on("state", (state) => {
      setGameState((g) => {
        if (state.gameId === g.gameId || g.gameId === 0) {
          console.log({ state, gameState });
          return state;
        }
        return g;
      });
    });

    socket.on("notification", (msg) => {
      if (msg.userId === localStorage.getItem("playerId")) {
        setMessage(msg.message);
      }
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
        scanDelay={0}
        constraints={{
          facingMode: "environment",
          frameRate: 60,
          width: 1920,
          height: 1080,
        }}
        // resolution={1500}
        onResult={(result) => {
          if (result) {
            if (isScanTimeout) return;
            const text = result.getText();
            setHasScannedRecently(true);
            setIsScanTimeout(true);
            socket?.emit("scan", {
              userId: localStorage.getItem("playerId"),
              targetId: text,
            });
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
      <div className="relative  h-full w-screen overflow-hidden min-safe-h-screen">
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

                let code = (Math.random() + 1).toString(36).substring(7);
                socket?.emit("join", { userId: code });
                localStorage.setItem("playerId", code);

                forceUpdate((p) => p + 1);
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
        <div
          className={`absolute top-0 left-0 w-full p-8 z-[50] flex flex-row justify-center py-2 ${
            playerInfo?.team === "humans"
              ? "bg-blue-500 text-white"
              : "bg-red-500 text-white"
          }`}
        >
          <span className="flex flex-col items-center w-full">
            {localStorage.getItem("playerId") && !playerInfo && (
              <div className="w-full flex flex-row justify-between items-center">
                &nbsp;<p>Loading</p>
                <div
                  className="bg-gray-100 text-black p-2 rounded-sm"
                  onClick={() => {
                    socket?.emit("leave", {
                      userId: localStorage.getItem("playerId"),
                    });
                    localStorage.removeItem("playerId");
                    setGameState({
                      gameOver: false,
                      players: [],
                      gameId: 0,
                    });
                  }}
                >
                  <p>Leave</p>
                </div>
              </div>
            )}
            {!localStorage.getItem("playerId") && (
              <p
                onClick={() => {
                  if (!localStorage.getItem("playerId")) {
                    let code = (Math.random() + 1).toString(36).substring(7);
                    socket?.emit("join", { userId: code });
                    console.log({ code });
                    localStorage.setItem("playerId", code);

                    forceUpdate((p) => p + 1);
                  }
                }}
              >
                Tap to join
              </p>
            )}
            {localStorage.getItem("playerId") && playerInfo && (
              <span className="w-full flex flex-row justify-between items-center">
                &nbsp;
                <p className="">
                  {playerInfo.team === "zombies" ? "🧟‍♂️" : "🧑‍⚕️"} Score:{" "}
                  {playerInfo.score} 🔢 {playerInfo.totalScore}
                </p>
                <div
                  className="bg-gray-100 text-black p-2 rounded-sm"
                  onClick={() => {
                    socket?.emit("leave", {
                      userId: localStorage.getItem("playerId"),
                    });
                    localStorage.removeItem("playerId");
                    setGameState({
                      gameOver: false,
                      players: [],
                      gameId: 0,
                    });
                  }}
                >
                  <p>Leave</p>
                </div>
              </span>
            )}
            <p>{message}</p>
          </span>
        </div>
      </div>
    </>
  );
};

export default App;
