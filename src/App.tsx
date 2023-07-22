import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  const [hasScannedRecently, setHasScannedRecently] = useState(false);
  const [isScanTimeout, setIsScanTimeout] = useState(false);
  const [, forceUpdate] = useState(0);

  const [scanning, setScanning] = useState(false); // toggleable state for "should render scanner"
  const [cameraError, setCameraError] = useState<any>(null); // error message from failing to access the camera

  const scannerRef = useRef(null); // reference to the scanner element in the DOM

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
        onDetected={(text: any) => {
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
        }}
      />
    );
  }, []);

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
            width="640"
            height="480"
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
          {localStorage.getItem("playerId") && !playerInfo && "Loading"}
          {!localStorage.getItem("playerId") && <p>Scan your QR to join</p>}
          {localStorage.getItem("playerId") && playerInfo && (
            <span className="flex flex-col">
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
            </span>
          )}
        </div>
      </div>
    </>
  );
};

export default App;
