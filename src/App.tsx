import { useEffect, useMemo, useRef, useState } from "react";

import Quagga from "@ericblade/quagga2";

import { Socket, io } from "socket.io-client";
import Scanner from "./Scanner";

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

  // const [isScanTimeout, setIsScanTimeout] = useState(false);
  const [, forceUpdate] = useState(0);

  const [scanning, setScanning] = useState(false); // toggleable state for "should render scanner"
  const [cameraError, setCameraError] = useState<any>(null); // error message from failing to access the camera

  const scannerRef = useRef(null); // reference to the scanner element in the DOM

  useEffect(() => {
    const timeout = setTimeout(() => setMessage(""), 1500);

    return () => {
      clearTimeout(timeout);
    };
  }, [message]);

  useEffect(() => {
    const enableCamera = async () => {
      await Quagga.CameraAccess.request(null, {});
    };
    const disableCamera = async () => {
      await Quagga.CameraAccess.release();
    };
    const enumerateCameras = async () => {
      const cameras = await Quagga.CameraAccess.enumerateVideoDevices();
      console.log("Cameras Detected: ", cameras);
      return cameras;
    };
    enableCamera()
      .then(disableCamera)
      .then(enumerateCameras)
      .then(() => Quagga.CameraAccess.disableTorch()) // disable torch at start, in case it was enabled before and we hot-reloaded
      .catch((err) => setCameraError(err));

    setTimeout(() => {
      setScanning(true);
    }, 2000);
    return () => {
      disableCamera();
    };
  }, []);

  useEffect(() => {
    if (
      !gameState.players.find(
        (p) => p.userId === localStorage.getItem("playerId")
      ) &&
      gameState.gameId !== 0
    ) {
      localStorage.removeItem("playerId");
    }
  });

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

    socket.on("result", (msg) => {
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

  const scanner = useMemo(() => {
    return (
      <Scanner
        scannerRef={scannerRef}
        facingMode="environment"
        onDetected={(result: any) => {
          socket?.emit("scan", {
            userId: localStorage.getItem("playerId"),
            targetId: result.codeResult.code,
          });
        }}
      />
    );
  }, []);

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

                if (!localStorage.getItem("playerId")) {
                  let code = (Math.random() + 1).toString(36).substring(7);
                  socket?.emit("join", { userId: code });
                  localStorage.setItem("playerId", code);

                  forceUpdate((p) => p + 1);
                }
              }}
            >
              Join new game
            </div>
          </div>
        )}

        {cameraError ? (
          <p>ERROR INITIALIZING CAMERA ${JSON.stringify(cameraError)}</p>
        ) : null}

        <div ref={scannerRef} className="flex-grow h-full">
          <video
            style={{
              width: window.innerWidth,
            }}
          />
          <canvas
            className="drawingBuffer absolute top-0 left-0 w-full h-full"
            width="1920"
            height="1080"
          />
          {scanning ? scanner : null}
        </div>

        <div
          className={`absolute top-0 left-0 w-full p-8 z-[50] flex flex-row justify-center py-2 ${
            playerInfo?.team === "humans"
              ? "bg-blue-500 text-white"
              : "bg-red-500 text-white"
          }`}
        >
          <span className="flex flex-col items-center w-full">
            {localStorage.getItem("playerId") && !playerInfo && "Loading"}
            {!localStorage.getItem("playerId") && (
              <p
                onClick={() => {
                  if (!localStorage.getItem("playerId")) {
                    let code = (Math.random() + 1).toString(36).substring(7);
                    socket?.emit("join", { userId: code });
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
