import { PositionRange } from "../position.js";
import { Statement } from "./statement.js";

export class ParserError extends Error {
    position: PositionRange;
    baseMessage: string;

    constructor(
        position: PositionRange,
        filePath: string,
        code: string,
        message: string
    ) {
        const positionInFile = position.getPositionInFile(code);

        super(
            `${message}\nIn ${filePath}:${positionInFile.start.line + 1}:${positionInFile.start.col} (${position.start})`
        );

        this.position = position;
        this.baseMessage = message;
    }
}

export function createUnexpctedError(
    position: PositionRange,
    filePath: string,
    code: string,
    expected: string,
    got?: string
): ParserError {
    return new ParserError(
        position,
        filePath,
        code,
        `Expected '${expected}'${got ? `and not '${got}'` : ""}!`
    );
}

export function createInvalidTagNameError(
    position: PositionRange,
    filePath: string,
    code: string,
    gotName: string
): ParserError {
    return new ParserError(
        position,
        filePath,
        code,
        `Invalid tag name '${gotName}'!`
    );
}

export function createDisalowedTagContexError(
    position: PositionRange,
    filePath: string,
    code: string,
    gotStatement: Statement
): ParserError {
    return new ParserError(
        position,
        filePath,
        code,
        `The tag '${gotStatement.name}' is not allowed here!`
    );
}

export function createUnexpectedAmountOfArgumentsError(
    position: PositionRange,
    filePath: string,
    code: string,
    expectedCount: number,
    gotCount: number
): ParserError {
    return new ParserError(
        position,
        filePath,
        code,
        `Expected ${expectedCount} number of arguments, but instead got ${gotCount}!`
    );
}

export function createEmptyExpressionError(
    position: PositionRange,
    filePath: string,
    code: string
): ParserError {
    return new ParserError(
        position,
        filePath,
        code,
        "Expected non empty expression!"
    );
}

export function createInvalidImportSlotsParamsOrder(
    position: PositionRange,
    filePath: string,
    code: string
): ParserError {
    return new ParserError(
        position,
        filePath,
        code,
        "The imports, slots or params are in the wrong order. First imports, then define the slots and last the params!"
    );
}

export function createSlotOutsideComponenterror(
    position: PositionRange,
    filePath: string,
    code: string
): ParserError {
    return new ParserError(
        position,
        filePath,
        code,
        "Slots can only exist inside components! If you ment to define a slot use '@defslot' instead. "
    );
}

export function createSlotDefinitionNamedMainError(
    position: PositionRange,
    filePath: string,
    code: string
): ParserError {
    return new ParserError(
        position,
        filePath,
        code,
        "Cannot define slots named main, they are already predefined!"
    );
}

