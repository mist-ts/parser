import { PositionRange } from "../position.js";
import {
    createInvalidTagNameError,
    createDisalowedTagContexError,
    createUnexpctedError,
    createUnexpectedAmountOfArgumentsError,
    createEmptyExpressionError,
    createInvalidImportSlotsParamsOrder,
    createSlotOutsideComponenterror,
    createSlotDefinitionNamedMainError,
} from "./error.js";
import { TsCodeExpression } from "./expression.js";
import {
    AssignStatement,
    ComponentMainSlotStatement,
    ComponentSlotStatement,
    ComponentStatement,
    DefineSlotStatement,
    EachStatement,
    ElseIfStatement,
    ElseStatement,
    EndStatement,
    IfStatement,
    ImportStatement,
    InlineSafeTsCodeStatement,
    InlineTsCodeStatement,
    LetStatement,
    ParamStatement,
    Statement,
    StatementName,
    TextStatement,
} from "./statement.js";

const PAREN_START = new Set(["(", "[", "{"]);
const PAREN_END = new Set([")", "]", "}"]);

interface ValuePosition {
    value: string;
    position: PositionRange;
}

export class Parser {
    #code: string;
    #filePath: string;
    #index = 0;
    #line = 0;

    constructor(code: string, filePath: string) {
        this.#code = code;
        this.#filePath = filePath;
    }

    #advance(times: number = 1) {
        for (let i = 0; i < times; i++) {
            this.#index++;

            if (this.#currentChar === "\n") this.#line++;
        }
    }

    #getCharAt(index: number): string | undefined {
        if (index >= this.#code.length) return undefined;

        return this.#code[index];
    }

    #peek(at: number = 1): string | undefined {
        return this.#getCharAt(this.#index + at);
    }

    #consume(char: string): void {
        if (this.#currentChar !== char) {
            throw createUnexpctedError(
                this.#createPosition(),
                this.#filePath,
                this.#code,
                char,
                this.#currentChar
            );
        }

        this.#advance();
    }

    get #currentChar(): string | undefined {
        return this.#getCharAt(this.#index);
    }

    #isAtEnd(): boolean {
        return this.#currentChar === undefined;
    }

    #createPosition(length: number = 1): PositionRange {
        return new PositionRange(this.#index, this.#line, this.#index + length);
    }

    #areImportStatementsAllowedAfter(statementName: StatementName): boolean {
        return [
            StatementName.TextStatement,
            StatementName.ImportStatement,
        ].includes(statementName);
    }

    #areDefineSlotStatementsAllowedAfter(
        statementName: StatementName
    ): boolean {
        return [
            StatementName.TextStatement,
            StatementName.ImportStatement,
            StatementName.DefineSlotStatement,
        ].includes(statementName);
    }

    #areParamStatementsAllowedAfter(statementName: StatementName): boolean {
        return [
            StatementName.TextStatement,
            StatementName.ParamStatement,
            StatementName.ImportStatement,
            StatementName.DefineSlotStatement,
        ].includes(statementName);
    }

    parse(): Statement[] {
        const statements: Statement[] = [];
        let allowImportStatements = true;
        let allowDefineSlotStatement = true;
        let allowParamStatement = true;

        while (!this.#isAtEnd()) {
            const statement = this.#parseOnce(
                allowImportStatements,
                allowDefineSlotStatement,
                allowParamStatement,
                false
            );

            if (
                allowImportStatements &&
                !this.#areImportStatementsAllowedAfter(statement.name)
            ) {
                allowImportStatements = false;
            }

            if (
                allowDefineSlotStatement &&
                !this.#areDefineSlotStatementsAllowedAfter(statement.name)
            ) {
                allowDefineSlotStatement = false;
            }

            if (
                allowParamStatement &&
                !this.#areParamStatementsAllowedAfter(statement.name)
            ) {
                allowParamStatement = false;
            }

            if (statement.hasToBeHandledInParse) {
                throw createDisalowedTagContexError(
                    statement.position,
                    this.#filePath,
                    this.#code,
                    statement
                );
            }

            statements.push(statement);
        }

        return statements;
    }

    paramsToCodeString(statements: Statement[]): string {
        const imports: ImportStatement[] = [];
        const params: ParamStatement[] = [];

        for (const statement of statements) {
            if (statement instanceof ImportStatement) imports.push(statement);
            else if (statement instanceof ParamStatement)
                params.push(statement);

            if (!this.#areParamStatementsAllowedAfter(statement.name)) break;
        }

        let code = "// Autogenerated code by typescript templating engine\n";

        for (const importStatement of imports) {
            code += `\n${importStatement.toTsCode().toMappedString()[1]}`;
        }

        if (imports.length !== 0) code += "\n";

        code += "\nexport interface Params {\n";

        for (const param of params) {
            code += `\t${param.toDeclarationFileCode()}\n`;
        }

        code += "}";

        return code;
    }

    #parseOnce(
        allowImportStatements: boolean,
        allowDefineSlotStatement: boolean,
        allowParamStatement: boolean,
        allowSlotStatement: boolean
    ): Statement {
        let accumilator: {
            value: string;
            startIndex: number;
            startLine: number;
        } = {
            value: "",
            startIndex: this.#index,
            startLine: this.#line,
        };

        const makeAccumilator = () => {
            return new TextStatement(
                new PositionRange(
                    accumilator.startIndex,
                    accumilator.startLine,
                    this.#index
                ),
                accumilator.value
            );
        };

        while (!this.#isAtEnd()) {
            if (
                this.#currentChar === "\\" &&
                this.#peek() === "{" &&
                this.#peek(2) === "{"
            ) {
                this.#advance(3);

                continue;
            } else if (
                (this.#currentChar === "{" && this.#peek() === "{") ||
                (this.#currentChar === "!" &&
                    this.#peek() === "{" &&
                    this.#peek() === "{")
            ) {
                if (accumilator.value) return makeAccumilator();

                if (this.#peek(2) === "-" && this.#peek(3) === "-") {
                    this.#skipInlineComment();

                    continue;
                }

                return this.#makeInlineTsCodeStatement();
            } else if (this.#currentChar === "\\" && this.#peek() === "@") {
                this.#advance(2);

                continue;
            } else if (this.#currentChar === "@") {
                if (accumilator.value) return makeAccumilator();

                const tag = this.#makeAtTag(
                    allowImportStatements,
                    allowDefineSlotStatement,
                    allowParamStatement,
                    allowSlotStatement
                );

                return tag;
            } else {
                accumilator.value += this.#currentChar;

                this.#advance();
            }
        }

        return makeAccumilator();
    }

    #parseUntilStatment(
        statementNames: StatementName[],
        allowSlotStatement: boolean = false
    ): [Statement[], Statement] {
        const statements: Statement[] = [];

        while (!this.#isAtEnd()) {
            const statement = this.#parseOnce(
                false,
                false,
                false,
                allowSlotStatement
            );

            if (statementNames.includes(statement.name)) {
                return [statements, statement];
            }

            statements.push(statement);
        }

        throw createUnexpctedError(
            this.#createPosition(),
            this.#filePath,
            this.#code,
            statementNames.join(",")
        );
    }

    #isValidTagChar(char: string): boolean {
        return /^[a-z0-9-_]$/i.test(char);
    }

    #areNextChars(controll: string): boolean {
        let i = 0;
        while (i < controll.length) {
            const match = this.#code[this.#index + i] === controll[i];
            if (!match) return false;

            i++;
        }

        return true;
    }

    #skipUntilAndWith<T extends string[]>(
        untilChars: T,
        allowEmpty: boolean = false
    ): ValuePosition & { controllChar: T[number] } {
        const startIndex = this.#index;
        const startLine = this.#line;

        let depth = 0;

        while (this.#currentChar) {
            if (PAREN_START.has(this.#currentChar)) {
                depth++;
                this.#advance();
                continue;
            } else if (depth > 0 && PAREN_END.has(this.#currentChar)) {
                depth--;
                this.#advance();
                continue;
            }

            if (depth === 0) {
                for (const controll of untilChars) {
                    const match = this.#areNextChars(controll);
                    if (!match) continue;

                    const value = this.#code.slice(startIndex, this.#index);
                    const endIndex = this.#index;

                    this.#advance(controll.length);

                    const trimed = this.#trimWithPosition(
                        value,
                        new PositionRange(startIndex, startLine, endIndex)
                    );

                    if (!allowEmpty && trimed.value.length === 0) {
                        throw createEmptyExpressionError(
                            new PositionRange(
                                startIndex,
                                startLine,
                                startIndex === endIndex
                                    ? startIndex + 1
                                    : endIndex
                            ),
                            this.#filePath,
                            this.#code
                        );
                    }

                    return {
                        position: trimed.position,
                        value: trimed.value,
                        controllChar: controll,
                    };
                }
            }

            this.#advance();
        }

        throw createUnexpctedError(
            this.#createPosition(),
            this.#filePath,
            this.#code,
            untilChars[0]!
        );
    }

    #trimWithPosition(value: string, position: PositionRange): ValuePosition {
        const valueTrimedStart = value.trimStart();
        const newStartIndex =
            position.start + (value.length - valueTrimedStart.length);

        const valueTrimedEnd = valueTrimedStart.trimEnd();
        const newEndIndex =
            position.end - (valueTrimedStart.length - valueTrimedEnd.length);

        return {
            value: valueTrimedEnd,
            position: new PositionRange(
                newStartIndex,
                position.lineStart,
                newEndIndex
            ),
        };
    }

    #parseParams(expectedCount: number): ValuePosition[] {
        let parsedArguments: ValuePosition[] = [];

        if (this.#currentChar !== "(") {
            if (expectedCount !== 0) {
                throw createUnexpectedAmountOfArgumentsError(
                    this.#createPosition(),
                    this.#filePath,
                    this.#code,
                    expectedCount,
                    0
                );
            }

            return [];
        }

        this.#advance();

        let argument;
        do {
            argument = this.#skipUntilAndWith([",", ")"] as const, true);
            parsedArguments.push({
                value: argument.value,
                position: argument.position,
            });
        } while (argument.controllChar !== ")");

        if (
            parsedArguments.at(-1) &&
            parsedArguments.at(-1)!.value.length === 0
        ) {
            parsedArguments = parsedArguments.slice(0, -1);
        }

        if (expectedCount !== parsedArguments.length) {
            throw createUnexpectedAmountOfArgumentsError(
                this.#createPosition(),
                this.#filePath,
                this.#code,
                expectedCount,
                parsedArguments.length
            );
        }

        return parsedArguments;
    }

    #makeInlineTsCodeStatement():
        | InlineTsCodeStatement
        | InlineSafeTsCodeStatement {
        const startIndex = this.#index;
        const startLine = this.#line;

        const isUnsafe = this.#currentChar === "!";
        if (isUnsafe) {
            this.#advance();
        }

        this.#advance(2);

        const expressionPosValue = this.#skipUntilAndWith(["}"], true);

        this.#consume("}");

        const tsCodeExpression = new TsCodeExpression(
            expressionPosValue.position,
            expressionPosValue.value
        );

        if (isUnsafe) {
            return new InlineTsCodeStatement(
                new PositionRange(startIndex, startLine, this.#index),
                tsCodeExpression
            );
        }

        return new InlineSafeTsCodeStatement(
            new PositionRange(startIndex, startLine, this.#index),
            tsCodeExpression
        );
    }

    #skipInlineComment(): void {
        this.#advance(4);
        this.#skipUntilAndWith(["--}}"], true);
    }

    #makeAtTag(
        allowImportStatements: boolean,
        allowDefineSlotStatement: boolean,
        allowParamStatement: boolean,
        allowSlotStatement: boolean
    ): Statement {
        const startIndex = this.#index;
        const startLine = this.#line;

        this.#advance();

        const tagNameStartIndex = this.#index;

        while (this.#currentChar && this.#isValidTagChar(this.#currentChar)) {
            this.#advance();
        }

        const tagNameEndIndex = this.#index;
        const tagName = this.#code.slice(tagNameStartIndex, tagNameEndIndex);

        switch (tagName) {
            case "each":
                return this.#makeEachStatement(startIndex, startLine);
            case "if":
                return this.#makeIfStatement(startIndex, startLine);
            case "elseif":
                return this.#makeElseIfStatement(startIndex, startLine);
            case "else":
                return this.#makeElseStatement(startIndex, startLine);
            case "let":
                return this.#makeLetStatement(startIndex, startLine);
            case "assign":
                return this.#makeAssignStatement(startIndex, startLine);
            case "component":
                return this.#makeComponentStatement(startIndex, startLine);
            case "import":
                if (!allowImportStatements) {
                    throw createInvalidImportSlotsParamsOrder(
                        new PositionRange(startIndex, startLine, this.#index),
                        this.#filePath,
                        this.#code
                    );
                }

                return this.#makeImportStatement(startIndex, startLine);
            case "param":
                if (!allowParamStatement) {
                    throw createInvalidImportSlotsParamsOrder(
                        new PositionRange(startIndex, startLine, this.#index),
                        this.#filePath,
                        this.#code
                    );
                }

                return this.#makeParamStatement(startIndex, startLine);
            case "defslot":
                if (!allowDefineSlotStatement) {
                    throw createInvalidImportSlotsParamsOrder(
                        new PositionRange(startIndex, startLine, this.#index),
                        this.#filePath,
                        this.#code
                    );
                }

                return this.#makeDefineSlotStatement(startIndex, startLine);
            case "slot":
                if (!allowSlotStatement) {
                    throw createSlotOutsideComponenterror(
                        new PositionRange(startIndex, startLine, this.#index),
                        this.#filePath,
                        this.#code
                    );
                }

                return this.#makeComponentSlotStatement(startIndex, startLine);
            case "end":
                return new EndStatement(
                    new PositionRange(startIndex, startLine, this.#index)
                );
            default:
                throw createInvalidTagNameError(
                    new PositionRange(startIndex, startLine, this.#index),
                    this.#filePath,
                    this.#code,
                    tagName
                );
        }
    }

    #makeEachStatement(startIndex: number, startLine: number): EachStatement {
        this.#consume("(");

        const variablePosValue = this.#skipUntilAndWith([" in ", ")"] as const);
        if (variablePosValue.controllChar !== " in ") {
            throw createUnexpctedError(
                new PositionRange(
                    variablePosValue.position.end,
                    startLine,
                    variablePosValue.position.end + 1
                ),
                this.#filePath,
                this.#code,
                "in",
                ")"
            );
        }

        let iteratorPosValue = this.#skipUntilAndWith([")"]);

        const variable = new TsCodeExpression(
            variablePosValue.position,
            variablePosValue.value
        );
        const iterator = new TsCodeExpression(
            iteratorPosValue?.position || this.#createPosition(),
            iteratorPosValue?.value || ""
        );

        const [children, _] = this.#parseUntilStatment([
            StatementName.EndStatement,
        ]);

        return new EachStatement(
            new PositionRange(startIndex, startLine, this.#index),
            iterator,
            variable,
            children
        );
    }

    #makeIfStatement(startIndex: number, startLine: number): IfStatement {
        this.#consume("(");

        const ifExpressionValuePos = this.#skipUntilAndWith([")"]);
        let [children, endingStatement] = this.#parseUntilStatment([
            StatementName.ElseIfStatement,
            StatementName.ElseStatement,
            StatementName.EndStatement,
        ]);

        const next =
            endingStatement instanceof EndStatement
                ? undefined
                : (endingStatement as ElseIfStatement | ElseStatement);

        return new IfStatement(
            new PositionRange(
                startIndex,
                startLine,
                next?.position.start || this.#index
            ),
            new TsCodeExpression(
                ifExpressionValuePos.position,
                ifExpressionValuePos.value
            ),
            children,
            next
        );
    }

    #makeElseIfStatement(
        startIndex: number,
        startLine: number
    ): ElseIfStatement {
        this.#consume("(");

        const ifExpressionValuePos = this.#skipUntilAndWith([")"]);
        const [children, endingStatement] = this.#parseUntilStatment([
            StatementName.ElseIfStatement,
            StatementName.ElseStatement,
            StatementName.EndStatement,
        ]);

        const next =
            endingStatement instanceof EndStatement
                ? undefined
                : (endingStatement as ElseIfStatement | ElseStatement);

        return new ElseIfStatement(
            new PositionRange(
                startIndex,
                startLine,
                next?.position.start || this.#index
            ),
            new TsCodeExpression(
                ifExpressionValuePos.position,
                ifExpressionValuePos.value
            ),
            children,
            next
        );
    }

    #makeElseStatement(startIndex: number, startLine: number): ElseStatement {
        this.#parseParams(0);

        const [children, _] = this.#parseUntilStatment([
            StatementName.EndStatement,
        ]);

        return new ElseStatement(
            new PositionRange(startIndex, startLine, this.#index),
            children
        );
    }

    #makeLetStatement(startIndex: number, startLine: number): LetStatement {
        this.#consume("(");

        const variableNameValuePos = this.#skipUntilAndWith([
            "=",
            ")",
        ] as const);
        let valueValuePos: ValuePosition | undefined = undefined;

        if (variableNameValuePos.controllChar === "=") {
            valueValuePos = this.#skipUntilAndWith([")"]);
        }

        return new LetStatement(
            new PositionRange(startIndex, startLine, this.#index),
            new TsCodeExpression(
                variableNameValuePos.position,
                variableNameValuePos.value
            ),
            valueValuePos &&
                new TsCodeExpression(
                    valueValuePos.position,
                    valueValuePos.value
                )
        );
    }

    #makeAssignStatement(
        startIndex: number,
        startLine: number
    ): AssignStatement {
        this.#consume("(");

        const variableNameValuePos = this.#skipUntilAndWith(["="]);
        const valueValuePos = this.#skipUntilAndWith([")"]);

        return new AssignStatement(
            new PositionRange(startIndex, startLine, this.#index),
            new TsCodeExpression(
                variableNameValuePos.position,
                variableNameValuePos.value
            ),
            new TsCodeExpression(valueValuePos.position, valueValuePos.value)
        );
    }

    #makeParamStatement(startIndex: number, startLine: number): ParamStatement {
        this.#consume("(");

        const identifierNameValuePos = this.#skipUntilAndWith([":"]);
        const typeValuePos = this.#skipUntilAndWith(["=", ")"] as const);
        let defaultValuePos: ValuePosition | undefined = undefined;

        if (typeValuePos.controllChar === "=") {
            defaultValuePos = this.#skipUntilAndWith([")"]);
        }

        return new ParamStatement(
            new PositionRange(startIndex, startLine, this.#index),
            new TsCodeExpression(
                identifierNameValuePos.position,
                identifierNameValuePos.value
            ),
            new TsCodeExpression(typeValuePos.position, typeValuePos.value),
            defaultValuePos &&
                new TsCodeExpression(
                    defaultValuePos.position,
                    defaultValuePos.value
                )
        );
    }

    #makeImportStatement(
        startIndex: number,
        startLine: number
    ): ImportStatement {
        this.#consume("(");

        const expressionValuePos = this.#skipUntilAndWith([")"]);

        return new ImportStatement(
            new PositionRange(startIndex, startLine, this.#index),
            new TsCodeExpression(
                expressionValuePos.position,
                expressionValuePos.value
            )
        );
    }

    #makeDefineSlotStatement(
        startIndex: number,
        startLine: number
    ): DefineSlotStatement {
        this.#consume("(");

        const slotNameValuePos = this.#skipUntilAndWith([":", ")"] as const);
        if (slotNameValuePos.value === "main") {
            throw createSlotDefinitionNamedMainError(
                slotNameValuePos.position,
                this.#filePath,
                this.#code
            );
        }

        let slotArgumentsValuePos: ValuePosition | undefined = undefined;

        if (slotNameValuePos.controllChar === ":") {
            slotArgumentsValuePos = this.#skipUntilAndWith([")"]);
        }

        return new DefineSlotStatement(
            new PositionRange(startIndex, startLine, this.#index),
            new TsCodeExpression(
                slotNameValuePos.position,
                slotNameValuePos.value
            ),
            slotArgumentsValuePos &&
                new TsCodeExpression(
                    slotArgumentsValuePos.position,
                    slotArgumentsValuePos.value
                )
        );
    }

    #makeComponentStatement(
        startIndex: number,
        startLine: number
    ): ComponentStatement {
        const tagParams = this.#parseParams(2);
        const componentNameValuePos = tagParams[0]!;
        const componentParamsValuePos = tagParams[1]!;

        const [statements, _] = this.#parseUntilStatment(
            [StatementName.EndStatement],
            true
        );

        const slots = statements.filter(
            (slot) => slot instanceof ComponentSlotStatement
        );
        const mainSlotChildren = statements.filter(
            (slot) => !(slot instanceof ComponentSlotStatement)
        );

        return new ComponentStatement(
            new PositionRange(startIndex, startLine, this.#index),
            new TsCodeExpression(
                componentNameValuePos.position,
                componentNameValuePos.value
            ),
            new TsCodeExpression(
                componentParamsValuePos.position,
                componentParamsValuePos.value
            ),
            new ComponentMainSlotStatement(
                new PositionRange(startIndex, startLine, this.#index),
                mainSlotChildren
            ),
            slots
        );
    }

    #makeComponentSlotStatement(
        startIndex: number,
        startLine: number
    ): ComponentSlotStatement {
        this.#consume("(");
        const slotNameValuePos = this.#skipUntilAndWith([",", ")"] as const);
        let slotParamsVariableValuePos: ValuePosition | undefined = undefined;

        if (slotNameValuePos.controllChar === ",") {
            slotParamsVariableValuePos = this.#skipUntilAndWith([")"]);
        }

        const [children, _] = this.#parseUntilStatment([
            StatementName.EndStatement,
        ]);

        return new ComponentSlotStatement(
            new PositionRange(startIndex, startLine, this.#index),
            new TsCodeExpression(
                slotNameValuePos.position,
                slotNameValuePos.value
            ),
            slotParamsVariableValuePos &&
                new TsCodeExpression(
                    slotParamsVariableValuePos.position,
                    slotParamsVariableValuePos.value
                ),
            children
        );
    }
}

