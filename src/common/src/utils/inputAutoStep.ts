/// <reference lib="dom" />
import {decimals, round} from "wenay-common2";

interface StepInputElement extends HTMLElement {
    value: string;
    step: string;
    min: string;
    max: string;
}

function isPowerOfTenth(step: number) {
    if (!(step > 0 && step < 1)) return false;
    const digits = Math.round(-Math.log10(step));
    return Math.abs(Math.pow(0.1, digits) - step) < step * 1e-9;
}

const appliedHandlers = new WeakMap<HTMLElement, () => void>();

export function setAutoStepForElement(element: StepInputElement, params: {minStep?: number | undefined, maxStep?: number} = {maxStep: 1}) {
    appliedHandlers.get(element)?.();
    function parse(valueStr: string) { const val = parseFloat(valueStr); return isNaN(val) ? null : val; }
    const {minStep, maxStep = 1} = params;
    const maxDigits = minStep ? decimals(minStep) : undefined;
    const stepDefault = parse(element.step);
    const minDefault = parse(element.min);
    const maxDefault = parse(element.max);
    const minDigits = maxStep > 0 ? Math.max(0, -Math.round(Math.log10(maxStep))) : 0;
    let digitsCurrent: number | null = null;
    let stepCurrent = parse(element.step);
    let minCurrent = parse(element.min);

    function calculateStep(valueStr: string) {
        const dotPos = valueStr.search(/\.|,/);
        let digits = dotPos >= 0 ? valueStr.length - dotPos - 1 : 0;
        digits = Math.max(digits, minDigits);
        if (digits > 10) digits = decimals(parseFloat(valueStr), 10, minDigits);
        if (maxDigits != null) digits = Math.min(digits, maxDigits);
        let step = round(Math.pow(0.1, digits), digits);
        if (minStep) step = round(Math.round(step / minStep) * minStep, digits);
        if (maxDefault != null && minDefault != null)
            if (maxDefault - minDefault < step * 2)
                return stepCurrent;
        digitsCurrent = digits;
        stepCurrent = step;
        if (minCurrent != null) {
            if (Math.abs(minCurrent) % step != 0)
                minCurrent = Math.floor(Math.abs(minCurrent) / step) * step * Math.sign(minCurrent);
            element.min = minCurrent + "";
        }
        element.step = step + "";
        return step;
    }

    let modeAuto = !stepCurrent || isPowerOfTenth(stepCurrent);
    if (modeAuto) {
        calculateStep((stepCurrent ? (Math.round(parseFloat(element.value) / stepCurrent) * stepCurrent) : element.value) + "");
    }
    if (stepCurrent && minDefault && Math.abs(minDefault % stepCurrent) > 1e-10)
        modeAuto = false;
    else if (stepCurrent && maxDefault && Math.abs(maxDefault % stepCurrent) > 1e-10)
        modeAuto = false;
    else modeAuto ||= (stepCurrent != null && (minStep == null || stepCurrent > minStep));

    const onKeyUp = () => { if (modeAuto) calculateStep(element.value); }

    const onChange = () => {
        const digits = digitsCurrent;
        if (digits != null) element.value = parseFloat(element.value).toFixed(digits);
        if (minDefault != null && parseFloat(element.value) < minDefault) {
            element.step = stepDefault + "";
            element.value = minDefault + "";
            element.min = minDefault + "";
            digitsCurrent = null;
        }
        element.setAttribute("value", element.value);
    }

    element.addEventListener("keyup", onKeyUp);
    element.addEventListener("change", onChange);
    const dispose = () => {
        element.removeEventListener("keyup", onKeyUp);
        element.removeEventListener("change", onChange);
        appliedHandlers.delete(element);
    };
    appliedHandlers.set(element, dispose);
    return dispose;
}