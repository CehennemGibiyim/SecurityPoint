export {};

export type FacePoint = { x: number; y: number };

export type FaceDetectionResult = {
  detection: {
    box: { x: number; y: number; width: number; height: number };
    score: number;
  };
  landmarks: {
    positions: FacePoint[];
    getLeftEye: () => FacePoint[];
    getRightEye: () => FacePoint[];
    getMouth: () => FacePoint[];
    getNose: () => FacePoint[];
    getJawOutline: () => FacePoint[];
  };
  descriptor: Float32Array;
};

declare global {
  interface Window {
    faceapi?: {
      nets: {
        tinyFaceDetector: { loadFromUri: (uri: string) => Promise<void> };
        faceLandmark68Net: { loadFromUri: (uri: string) => Promise<void> };
        faceRecognitionNet: { loadFromUri: (uri: string) => Promise<void> };
      };
      TinyFaceDetectorOptions: new (opts: {
        inputSize: number;
        scoreThreshold: number;
      }) => unknown;
      detectSingleFace: (
        input: HTMLVideoElement | HTMLCanvasElement,
        options: unknown,
      ) => {
        withFaceLandmarks: () => {
          withFaceDescriptor: () => Promise<FaceDetectionResult | undefined>;
        };
      };
    };
  }
}
