import { PositionRange } from "../position.js";
import { TsCodeExpression } from "./expression.js";
import { safeString } from "./safeString.js";
import { ToTsCodeable, TsCode, TsCodeArray } from "./tsCode.js";

export enum StatementName {
    TextStatement = "TextStatement",
    InlineTsCodeStatement = "InlineTsCodeStatement",
    InlineSafeTsCodeStatement = "InlineSafeTsCodeStatement",
    EachStatement = "EachStatement",
    EndStatement = "EndStatement",
    IfStatement = "IfStatement",
    ElseIfStatement = "ElseIfStatement",
    ElseStatement = "ElseStatement",
    LetStatement = "LetStatement",
    AssignStatement = "AssignStatement",
    ParamStatement = "ParamStatement",
    ImportStatement = "ImportStatement",
    DefineSlotStatement = "DefineSlotStatement",
    ComponentStatement = "ComponentStatement",
    ComponentMainSlotStatement = "ComponentMainSlotStatement",
    ComponentSlotStatement = "ComponentSlotStatement",
}

type TextStatementObject = {
    type: StatementName.TextStatement;
    value: string;
};

type InlineTsCodeStatementObject = {
    type: StatementName.InlineTsCodeStatement;
    expression: string;
};

type InlineSafeTsCodeStatementObject = {
    type: StatementName.InlineSafeTsCodeStatement;
    expression: string;
};

type EachStatementObject = {
    type: StatementName.EachStatement;
    variable: string;
    iterator: string;
    children: StatementObject[];
};

type IfStatementObject = {
    type: StatementName.IfStatement;
    expression: string;
    children: StatementObject[];
    next: ElseIfStatementObject | ElseStatementObject | undefined;
};

type ElseIfStatementObject = {
    type: StatementName.ElseIfStatement;
    expression: string;
    children: StatementObject[];
    next: ElseIfStatementObject | ElseStatementObject | undefined;
};

type ElseStatementObject = {
    type: StatementName.ElseStatement;
    children: StatementObject[];
};

type LetStatementObject = {
    type: StatementName.LetStatement;
    variableName: string;
    variableValue: string | undefined;
};

type AssingStatementObject = {
    type: StatementName.AssignStatement;
    variableName: string;
    variableValue: string;
};

type ParamStatementObject = {
    type: StatementName.ParamStatement;
    paramName: string;
    paramType: string;
    paramDefaultValue: string | undefined;
};

type ImportStatementObject = {
    type: StatementName.ImportStatement;
    expression: string;
};

type DefineSlotStatementObject = {
    type: StatementName.DefineSlotStatement;
    slotName: string;
    slotArguments: string | undefined;
};

type ComponentStatementObject = {
    type: StatementName.ComponentStatement;
    component: string;
    params: string;
    mainSlot: ComponentMainSlotStatementObject;
    slots: ComponentSlotStatementObject[];
};

type ComponentMainSlotStatementObject = {
    type: StatementName.ComponentMainSlotStatement;
    children: StatementObject[];
};

type ComponentSlotStatementObject = {
    type: StatementName.ComponentSlotStatement;
    slotName: string;
    paramsVariable: string | undefined;
    children: StatementObject[];
};

export type StatementObject =
    | TextStatementObject
    | InlineTsCodeStatementObject
    | InlineSafeTsCodeStatementObject
    | EachStatementObject
    | IfStatementObject
    | ElseIfStatementObject
    | ElseStatementObject
    | LetStatementObject
    | AssingStatementObject
    | ParamStatementObject
    | ImportStatementObject
    | DefineSlotStatementObject
    | ComponentStatementObject
    | ComponentMainSlotStatementObject
    | ComponentSlotStatementObject;

function childrenToObject<T extends Statement>(
    children: T[]
): Exclude<ReturnType<T["toObject"]>, null>[] {
    return children
        .map((child) => child.toObject())
        .filter((child) => child !== null) as Exclude<
        ReturnType<T["toObject"]>,
        null
    >[];
}

function childrenToCompiledString(children: Statement[]): string {
    let compiledString = "\n";
    for (const child of children) {
        compiledString += child.toCompiledString() + "\n";
    }

    return compiledString;
}

function setCompiledStringLine(line: number, compiledString: string): string {
    return `$line = ${line + 1}\n\t${compiledString}`;
}

export abstract class Statement implements ToTsCodeable {
    abstract readonly name: StatementName;

    hasToBeHandledInParse: boolean = false;
    readonly position: PositionRange;

    constructor(position: PositionRange) {
        this.position = position;
    }

    abstract toTsCode(): TsCode | null;
    abstract toObject(): StatementObject | null;
    abstract toCompiledString(): string;
}

export class TextStatement extends Statement {
    override name = StatementName.TextStatement;
    #value: string;

    constructor(position: PositionRange, value: string) {
        super(position);

        this.#value = value;
    }

    override toTsCode(): null {
        return null;
    }

    override toObject(): TextStatementObject {
        return {
            type: StatementName.TextStatement,
            value: this.#value,
        };
    }

    override toCompiledString(): string {
        return `out += "${safeString(this.#value)}"`;
    }
}

export class InlineTsCodeStatement extends Statement {
    override name = StatementName.InlineTsCodeStatement;
    #expression: TsCodeExpression;

    constructor(position: PositionRange, value: TsCodeExpression) {
        super(position);

        this.#expression = value;
    }

    override toTsCode(): TsCode {
        return new TsCode(
            this.position.start,
            false,
            TsCode.builder`String(${this.#expression})`
        );
    }

    override toObject(): InlineTsCodeStatementObject {
        return {
            type: StatementName.InlineTsCodeStatement,
            expression: this.#expression.toString(),
        };
    }

    override toCompiledString(): string {
        return setCompiledStringLine(
            this.position.lineStart,
            `out += String(${this.#expression.toString()})`
        );
    }
}

export class InlineSafeTsCodeStatement extends Statement {
    override name = StatementName.InlineSafeTsCodeStatement;
    override hasToBeHandledInParse = false;
    #expression: TsCodeExpression;

    constructor(position: PositionRange, expression: TsCodeExpression) {
        super(position);

        this.#expression = expression;
    }

    override toTsCode(): TsCode | null {
        return new TsCode(
            this.position.start,
            false,
            TsCode.builder`String(${this.#expression})`
        );
    }

    override toObject(): InlineSafeTsCodeStatementObject {
        return {
            type: StatementName.InlineSafeTsCodeStatement,
            expression: this.#expression.toString(),
        };
    }

    override toCompiledString(): string {
        return `out += $api.safeString(String(${this.#expression.toString()}))`;
    }
}

export class EachStatement extends Statement {
    override name = StatementName.EachStatement;
    #iterator: TsCodeExpression;
    #variable: TsCodeExpression;
    #children: Statement[];

    constructor(
        position: PositionRange,
        iterator: TsCodeExpression,
        variable: TsCodeExpression,
        children: Statement[]
    ) {
        super(position);

        this.#iterator = iterator;
        this.#variable = variable;
        this.#children = children;
    }

    override toTsCode(): TsCode {
        return new TsCode(
            this.position.start,
            false,
            TsCode.builder`for (const ${this.#variable} of ${this.#iterator}) {\n${new TsCodeArray(this.#children)}\n}`
        );
    }

    override toObject(): EachStatementObject {
        return {
            type: StatementName.EachStatement,
            variable: this.#variable.toString(),
            iterator: this.#variable.toString(),
            children: childrenToObject(this.#children),
        };
    }

    override toCompiledString(): string {
        return setCompiledStringLine(
            this.position.lineStart,
            `for (const ${this.#variable.toString()} of ${this.#iterator.toString()}) {${childrenToCompiledString(this.#children)}}`
        );
    }
}

export class EndStatement extends Statement {
    override name = StatementName.EndStatement;
    constructor(position: PositionRange) {
        super(position);
    }

    override toTsCode(): null {
        return null;
    }

    override toObject(): null {
        return null;
    }

    override toCompiledString(): string {
        return "";
    }
}

export class IfStatement extends Statement {
    override name = StatementName.IfStatement;
    #expression: TsCodeExpression;
    #children: Statement[];
    #next: ElseIfStatement | ElseStatement | undefined;

    constructor(
        position: PositionRange,
        expression: TsCodeExpression,
        children: Statement[],
        next?: ElseIfStatement | ElseStatement
    ) {
        super(position);

        this.#expression = expression;
        this.#children = children;
        this.#next = next;
    }

    override toTsCode(): TsCode {
        const builder = this.#next
            ? TsCode.builder`if (${this.#expression}) {\n${new TsCodeArray(this.#children)}\n}\n${this.#next}`
            : TsCode.builder`if (${this.#expression}) {\n${new TsCodeArray(this.#children)}\n}`;

        return new TsCode(this.position.start, false, builder);
    }

    override toObject(): IfStatementObject {
        return {
            type: StatementName.IfStatement,
            expression: this.#expression.toString(),
            children: childrenToObject(this.#children),
            next: this.#next?.toObject() || undefined,
        };
    }

    override toCompiledString(): string {
        return setCompiledStringLine(
            this.position.lineStart,
            `if (${this.#expression.toString()}) {${childrenToCompiledString(this.#children)}}${this.#next ? `\n${this.#next.toCompiledString()}` : ""}`
        );
    }
}

export class ElseIfStatement extends Statement {
    override name = StatementName.ElseIfStatement;
    override hasToBeHandledInParse = true;
    #expression: TsCodeExpression;
    #children: Statement[];
    #next: ElseIfStatement | ElseStatement | undefined;

    constructor(
        position: PositionRange,
        expression: TsCodeExpression,
        children: Statement[],
        next?: ElseIfStatement | ElseStatement
    ) {
        super(position);

        this.#expression = expression;
        this.#children = children;
        this.#next = next;
    }

    override toTsCode(): TsCode {
        const builder = this.#next
            ? TsCode.builder`else if (${this.#expression}) {\n${new TsCodeArray(this.#children)}\n}\n${this.#next}`
            : TsCode.builder`else if (${this.#expression}) {\n${new TsCodeArray(this.#children)}\n}`;

        return new TsCode(this.position.start, false, builder);
    }

    override toObject(): ElseIfStatementObject {
        return {
            type: StatementName.ElseIfStatement,
            expression: this.#expression.toString(),
            children: childrenToObject(this.#children),
            next: this.#next?.toObject() || undefined,
        };
    }

    override toCompiledString(): string {
        return setCompiledStringLine(
            this.position.lineStart,
            `elseif (${this.#expression.toString()}) {${childrenToCompiledString(this.#children)}}${this.#next ? `\n${this.#next.toCompiledString()}` : ""}`
        );
    }
}

export class ElseStatement extends Statement {
    override name = StatementName.ElseStatement;
    override hasToBeHandledInParse = true;
    #children: Statement[];

    constructor(position: PositionRange, children: Statement[]) {
        super(position);

        this.#children = children;
    }

    override toTsCode(): TsCode {
        return new TsCode(
            this.position.start,
            false,
            TsCode.builder`else {\n${new TsCodeArray(this.#children)}\n}`
        );
    }

    override toObject(): ElseStatementObject {
        return {
            type: StatementName.ElseStatement,
            children: childrenToObject(this.#children),
        };
    }

    override toCompiledString(): string {
        return setCompiledStringLine(
            this.position.lineStart,
            `else {${childrenToCompiledString(this.#children)}}`
        );
    }
}

export class LetStatement extends Statement {
    override name = StatementName.LetStatement;
    override hasToBeHandledInParse = false;
    #variableName: TsCodeExpression;
    #value: TsCodeExpression | undefined;

    constructor(
        position: PositionRange,
        variableName: TsCodeExpression,
        value?: TsCodeExpression
    ) {
        super(position);

        this.#variableName = variableName;
        this.#value = value;
    }

    override toTsCode(): TsCode {
        const builder = this.#value
            ? TsCode.builder`let ${this.#variableName} = ${this.#value}`
            : TsCode.builder`let ${this.#variableName}`;

        return new TsCode(this.position.start, false, builder);
    }

    override toObject(): LetStatementObject {
        return {
            type: StatementName.LetStatement,
            variableName: this.#variableName.toString(),
            variableValue: this.#value?.toString(),
        };
    }

    override toCompiledString(): string {
        return setCompiledStringLine(
            this.position.lineStart,
            `let ${this.#variableName.toString()}${this.#value ? ` = ${this.#value.toString()}` : ""}`
        );
    }
}

export class AssignStatement extends Statement {
    override name = StatementName.LetStatement;
    override hasToBeHandledInParse = false;
    #variableName: TsCodeExpression;
    #value: TsCodeExpression;

    constructor(
        position: PositionRange,
        variableName: TsCodeExpression,
        value: TsCodeExpression
    ) {
        super(position);

        this.#variableName = variableName;
        this.#value = value;
    }

    override toTsCode(): TsCode {
        return new TsCode(
            this.position.start,
            false,
            TsCode.builder`${this.#variableName} = ${this.#value}`
        );
    }

    override toObject(): AssingStatementObject {
        return {
            type: StatementName.AssignStatement,
            variableName: this.#variableName.toString(),
            variableValue: this.#value.toString(),
        };
    }

    override toCompiledString(): string {
        return setCompiledStringLine(
            this.position.lineStart,
            `${this.#variableName.toString()} = ${this.#value.toString()}`
        );
    }
}

export class ParamStatement extends Statement {
    override name = StatementName.ParamStatement;
    override hasToBeHandledInParse = false;
    #name: TsCodeExpression;
    #type: TsCodeExpression;
    #defaultValue: TsCodeExpression | undefined;

    constructor(
        position: PositionRange,
        name: TsCodeExpression,
        type: TsCodeExpression,
        defaultValue?: TsCodeExpression
    ) {
        super(position);

        this.#name = name;
        this.#type = type;
        this.#defaultValue = defaultValue;
    }

    override toTsCode(): TsCode {
        const builder = this.#defaultValue
            ? TsCode.builder`const ${this.#name}: ${this.#type} = ${this.#defaultValue}`
            : TsCode.builder`declare const ${this.#name}: ${this.#type}`;

        return new TsCode(this.position.start, false, builder);
    }

    override toObject(): ParamStatementObject {
        return {
            type: StatementName.ParamStatement,
            paramName: this.#name.toString(),
            paramType: this.#type?.toString(),
            paramDefaultValue: this.#defaultValue?.toString(),
        };
    }

    override toCompiledString(): string {
        return "";
    }

    toDeclarationFileCode(): string {
        return `${this.#name.toTsCode().toMappedString()[1]}: ${this.#type.toTsCode().toMappedString()[1]}`;
    }

    toTsInterfaceItem(): string {
        return `export interface $Params {\n${this.#name.toString()}${this.defaultValue ? "?" : ""}: ${this.#type.toString()}\n}`;
    }

    get variableName(): string {
        return this.#name.toString();
    }

    get defaultValue(): string | undefined {
        return this.#defaultValue?.toString();
    }
}

export class ImportStatement extends Statement {
    override name = StatementName.ImportStatement;
    override hasToBeHandledInParse = false;
    #expression: TsCodeExpression;

    constructor(position: PositionRange, expression: TsCodeExpression) {
        super(position);

        this.#expression = expression;
    }

    override toTsCode(): TsCode {
        return new TsCode(
            this.position.start,
            false,
            TsCode.builder`import ${this.#expression}`
        );
    }

    override toObject(): ImportStatementObject {
        return {
            type: StatementName.ImportStatement,
            expression: this.#expression.toString(),
        };
    }

    override toCompiledString(): string {
        return "";
    }

    get filePath(): string | undefined {
        const regex = /"(.*)"|'(.*)'|`(.*)`/;
        const expressionString = this.#expression
            .toTsCode()
            .toMappedString()[1];

        const matches = regex.exec(expressionString);
        if (!matches) return;

        return matches[0] || matches[1] || matches[2];
    }

    toImportTsStatement(): string {
        return `import ${this.#expression.toString()}`;
    }
}

export class DefineSlotStatement extends Statement {
    override name = StatementName.DefineSlotStatement;
    override hasToBeHandledInParse = false;
    #slotName: TsCodeExpression;
    #slotArguments: TsCodeExpression | undefined;

    constructor(
        position: PositionRange,
        slotName: TsCodeExpression,
        slotArguments?: TsCodeExpression
    ) {
        super(position);

        this.#slotName = slotName;
        this.#slotArguments = slotArguments;
    }

    override toTsCode(): TsCode {
        const builder = this.#slotArguments
            ? TsCode.builder`interface $Slots {\n${this.#slotName}: ${this.#slotArguments}\n}`
            : TsCode.builder`interface $Slots {\n${this.#slotName}: {}\n}`;

        return new TsCode(this.position.start, false, builder);
    }

    override toObject(): DefineSlotStatementObject {
        return {
            type: StatementName.DefineSlotStatement,
            slotName: this.#slotName.toString(),
            slotArguments: this.#slotArguments?.toString(),
        };
    }

    override toCompiledString(): string {
        return "";
    }

    get slotName(): string {
        return this.#slotName.toString();
    }

    get slotNameSafe(): string {
        return safeString(this.#slotName.toString());
    }

    get slotArguments(): string | undefined {
        return this.#slotArguments?.toString();
    }

    toTsInterface(): string {
        return `export interface $Slots {\n${this.#slotName.toString()}: ${this.#slotArguments ? this.#slotArguments.toString() : "{}"}\n}`;
    }
}

export class ComponentStatement extends Statement {
    override name = StatementName.ComponentStatement;
    override hasToBeHandledInParse = false;
    #component: TsCodeExpression;
    #params: TsCodeExpression;
    #mainSlot: ComponentMainSlotStatement;
    #slots: ComponentSlotStatement[];

    constructor(
        position: PositionRange,
        component: TsCodeExpression,
        params: TsCodeExpression,
        mainSlot: ComponentMainSlotStatement,
        slots: ComponentSlotStatement[]
    ) {
        super(position);

        this.#component = component;
        this.#params = params;
        this.#mainSlot = mainSlot;
        this.#slots = slots;
    }

    override toTsCode(): TsCode {
        return new TsCode(
            this.position.start,
            false,
            TsCode.builder`await ${this.#component}.$render(${this.#params}, {\n${this.#mainSlot}, \n${new TsCodeArray(this.#slots, ", \n")}\n})`
        );
    }

    override toObject(): ComponentStatementObject {
        return {
            type: StatementName.ComponentStatement,
            component: this.#component.toString(),
            params: this.#params.toString(),
            mainSlot: this.#mainSlot.toObject(),
            slots: childrenToObject(this.#slots),
        };
    }

    override toCompiledString(): string {
        return `out += await $api.renderComponent(${this.#component.toString()}, ${this.#params}, {\n${this.#mainSlot.toCompiledString()}${childrenToCompiledString(this.#slots)}})\n`;
    }
}

export class ComponentMainSlotStatement extends Statement {
    override name = StatementName.ComponentMainSlotStatement;
    override hasToBeHandledInParse = true;
    #children: Statement[];

    constructor(position: PositionRange, children: Statement[]) {
        super(position);

        this.#children = children;
    }

    override toTsCode(): TsCode {
        return new TsCode(
            this.position.start,
            false,
            TsCode.builder`main: async () => {\n${new TsCodeArray(this.#children)}\n\treturn ""\n}`
        );
    }

    override toObject(): ComponentMainSlotStatementObject {
        return {
            type: StatementName.ComponentMainSlotStatement,
            children: childrenToObject(this.#children),
        };
    }

    override toCompiledString(): string {
        return `main: async () => {\n\tlet out = ""${childrenToCompiledString(this.#children)}return out\n}, `;
    }
}

export class ComponentSlotStatement extends Statement {
    override name = StatementName.ComponentSlotStatement;
    override hasToBeHandledInParse = true;
    #slotName: TsCodeExpression;
    #paramsVariable: TsCodeExpression | undefined;
    #children: Statement[];

    constructor(
        position: PositionRange,
        slotName: TsCodeExpression,
        paramsVariable: TsCodeExpression | undefined,
        children: Statement[]
    ) {
        super(position);

        this.#slotName = slotName;
        this.#paramsVariable = paramsVariable;
        this.#children = children;
    }

    override toTsCode(): TsCode {
        const builder = this.#paramsVariable
            ? TsCode.builder`${this.#slotName}: async (${this.#paramsVariable}) => {\n${new TsCodeArray(this.#children)}\n\treturn ""\n}`
            : TsCode.builder`${this.#slotName}: async () => {\n${new TsCodeArray(this.#children)}\n\treturn ""\n}`;

        return new TsCode(this.position.start, false, builder);
    }

    override toObject(): ComponentSlotStatementObject {
        return {
            type: StatementName.ComponentSlotStatement,
            slotName: this.#slotName.toString(),
            paramsVariable: this.#paramsVariable?.toString(),
            children: childrenToObject(this.#children),
        };
    }

    override toCompiledString(): string {
        return `${this.#slotName.toString()}: async (${this.#paramsVariable ? this.#paramsVariable.toString() : ""}) => {\n\tlet out = ""${childrenToCompiledString(this.#children)}return out\n}, `;
    }
}

