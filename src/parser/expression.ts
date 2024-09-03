import { PositionRange } from "../position.js";
import { ToTsCodeable, TsCode } from "./tsCode.js";

export abstract class Expression implements ToTsCodeable {
    position: PositionRange;

    constructor(position: PositionRange) {
        this.position = position;
    }

    abstract toTsCode(): TsCode;
    abstract toString(): string;
}

export class TsCodeExpression extends Expression {
    #value: string;

    constructor(position: PositionRange, value: string) {
        super(position);

        this.#value = value;
    }

    override toTsCode(): TsCode {
        return new TsCode(this.position.start, true, {
            sourceOffset: this.position.start,
            parentOffset: 0,
            children: [],
            literal: this.#value,
        });
    }

    override toString(): string {
        return this.#value;
    }
}

