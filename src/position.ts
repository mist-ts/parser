interface PositionInFile {
    index: number;
    line: number;
    col: number;
}

interface PositionRangeInFile {
    start: PositionInFile;
    end: PositionInFile;
}

export class PositionRange {
    readonly start: number;
    readonly end: number;
    readonly lineStart: number;

    constructor(start: number, lineStart: number, end?: number) {
        this.start = start;
        this.lineStart = lineStart;
        this.end = end ?? start + 1;
    }

    copy(): PositionRange {
        return new PositionRange(this.start, this.end);
    }

    get length(): number {
        return this.end - this.start;
    }

    toObject() {
        return {
            start: this.start,
            end: this.end,
        };
    }

    getPositionInFile(code: string): PositionRangeInFile {
        let line = 0;
        let column = 0;

        let startPos: PositionInFile;

        let i = 0;
        while (i < this.end) {
            column++;

            if (code[i] === "\n") {
                line++;
                column = 0;
            }

            if (i === this.start) {
                startPos = {
                    index: this.start,
                    line: line,
                    col: column,
                };
            }

            i++;
        }

        return {
            start: startPos!,
            end: {
                index: this.end,
                line: line,
                col: column,
            },
        };
    }
}

