import { FreehandObject } from '../models/FreehandObject';

export type RecognitionMode =
  | 'handwriting'
  | 'equation'
  | 'diagram'
  | 'circuit'
  | 'verilog';

export interface RecognitionResultBase {
  mode: RecognitionMode;
  sourceObjectIds: string[];
  recognizedText: string;
  summary: string;
  confidence?: number;
  structuredData?: unknown;
}

export interface HandwritingRecognitionResult extends RecognitionResultBase {
  mode: 'handwriting';
}

export interface EquationRecognitionResult extends RecognitionResultBase {
  mode: 'equation';
  equation: string;
  latex: string;
}

export interface DiagramRecognitionResult extends RecognitionResultBase {
  mode: 'diagram';
  description: string;
  nodes: Array<{
    id: string;
    label: string;
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  edges: Array<{ from: string; to: string; label?: string }>;
}

export interface CircuitRecognitionResult extends RecognitionResultBase {
  mode: 'circuit';
  description: string;
  components: Array<{
    id: string;
    label: string;
    componentType: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  connections: Array<{ from: string; to: string; label?: string }>;
}

export interface VerilogRecognitionResult extends RecognitionResultBase {
  mode: 'verilog';
  code: string;
}

export interface HandwritingRecognitionProvider {
  recognizeFreehandStrokes(strokes: FreehandObject[]): Promise<HandwritingRecognitionResult>;
}

export interface EquationRecognitionProvider {
  recognizeEquations(strokes: FreehandObject[]): Promise<EquationRecognitionResult>;
}

export interface DiagramRecognitionProvider {
  recognizeDiagrams(strokes: FreehandObject[]): Promise<DiagramRecognitionResult>;
}

export interface CircuitRecognitionProvider {
  recognizeCircuits(strokes: FreehandObject[]): Promise<CircuitRecognitionResult>;
}

export interface VerilogRecognitionProvider {
  recognizeVerilog(strokes: FreehandObject[]): Promise<VerilogRecognitionResult>;
}

export interface RecognitionProvider
  extends HandwritingRecognitionProvider,
    EquationRecognitionProvider,
    DiagramRecognitionProvider,
    CircuitRecognitionProvider,
    VerilogRecognitionProvider {}

export class MockRecognitionProvider implements RecognitionProvider {
  private async simulateDelay(): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, 650));
  }

  public async recognizeFreehandStrokes(
    strokes: FreehandObject[]
  ): Promise<HandwritingRecognitionResult> {
    await this.simulateDelay();
    const sourceObjectIds = strokes.map((stroke) => stroke.id);
    const recognizedText = 'Demo handwriting recognition output. Edit as needed.';
    return {
      mode: 'handwriting',
      sourceObjectIds,
      recognizedText,
      summary: 'Demo recognition — AI model not connected.',
      structuredData: null,
    };
  }

  public async recognizeEquations(
    strokes: FreehandObject[]
  ): Promise<EquationRecognitionResult> {
    await this.simulateDelay();
    const sourceObjectIds = strokes.map((stroke) => stroke.id);
    const equation = 'V = IR';
    return {
      mode: 'equation',
      sourceObjectIds,
      recognizedText: equation,
      summary: 'Demo equation recognition — AI model not connected.',
      equation,
      latex: equation,
      structuredData: { expression: equation },
    };
  }

  public async recognizeDiagrams(
    strokes: FreehandObject[]
  ): Promise<DiagramRecognitionResult> {
    await this.simulateDelay();
    const sourceObjectIds = strokes.map((stroke) => stroke.id);
    return {
      mode: 'diagram',
      sourceObjectIds,
      recognizedText: 'Flowchart with Start → Process → End',
      summary: 'Demo diagram recognition — AI model not connected.',
      description: 'Simple flowchart with three nodes and two arrows.',
      nodes: [
        { id: 'start', label: 'Start', type: 'ellipse', x: 0, y: 0, width: 120, height: 64 },
        { id: 'process', label: 'Process', type: 'rectangle', x: 0, y: 120, width: 140, height: 72 },
        { id: 'end', label: 'End', type: 'ellipse', x: 0, y: 260, width: 120, height: 64 },
      ],
      edges: [
        { from: 'start', to: 'process', label: 'next' },
        { from: 'process', to: 'end', label: 'next' },
      ],
    };
  }

  public async recognizeCircuits(
    strokes: FreehandObject[]
  ): Promise<CircuitRecognitionResult> {
    await this.simulateDelay();
    const sourceObjectIds = strokes.map((stroke) => stroke.id);
    return {
      mode: 'circuit',
      sourceObjectIds,
      recognizedText: 'Battery → Resistor → Lamp → Ground',
      summary: 'Demo circuit recognition — AI model not connected.',
      description: 'Demonstration circuit with battery, resistor, and lamp.',
      components: [
        { id: 'battery', label: 'Battery', componentType: 'battery', x: 0, y: 0, width: 110, height: 64 },
        { id: 'resistor', label: 'R1', componentType: 'resistor', x: 0, y: 120, width: 110, height: 54 },
        { id: 'lamp', label: 'Lamp', componentType: 'lamp', x: 0, y: 240, width: 110, height: 64 },
      ],
      connections: [
        { from: 'battery', to: 'resistor', label: '' },
        { from: 'resistor', to: 'lamp', label: '' },
        { from: 'lamp', to: 'battery', label: '' },
      ],
    };
  }

  public async recognizeVerilog(
    strokes: FreehandObject[]
  ): Promise<VerilogRecognitionResult> {
    await this.simulateDelay();
    const sourceObjectIds = strokes.map((stroke) => stroke.id);
    const code = `module counter;

  always @(posedge clk) begin
    q <= q + 1;
  end

endmodule`;
    return {
      mode: 'verilog',
      sourceObjectIds,
      recognizedText: code,
      summary: 'Demo Verilog recognition — AI model not connected.',
      code,
      structuredData: { language: 'verilog' },
    };
  }
}

export class RecognitionService {
  constructor(private provider: RecognitionProvider) {}

  public recognize(
    mode: RecognitionMode,
    strokes: FreehandObject[]
  ): Promise<RecognitionResultBase> {
    switch (mode) {
      case 'equation':
        return this.provider.recognizeEquations(strokes);
      case 'diagram':
        return this.provider.recognizeDiagrams(strokes);
      case 'circuit':
        return this.provider.recognizeCircuits(strokes);
      case 'verilog':
        return this.provider.recognizeVerilog(strokes);
      case 'handwriting':
      default:
        return this.provider.recognizeFreehandStrokes(strokes);
    }
  }
}

export class HandwritingRecognitionService extends RecognitionService {}
export class MockHandwritingRecognitionProvider extends MockRecognitionProvider {}
