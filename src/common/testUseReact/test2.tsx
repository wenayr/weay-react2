type Point = {
    x: number;
    y: number;
};

type Sprite = {
    img: HTMLImageElement;
    sx: number;
    sy: number;
    sw: number;
    sh: number;
    x: number;
    y: number;
    scale?: number;
    frame?: number;
    frames?: number;
    fps?: number;
};

const drawSprite = (ctx: CanvasRenderingContext2D, s: Sprite) => {
    if (!s.img) return;
    ctx.save();
    ctx.translate(s.x, s.y);
    if (s.scale) ctx.scale(s.scale, s.scale);
    if (s.frame !== undefined && s.frames !== undefined) {
        const frameWidth = s.sw;
        const frameX = (s.frame % s.frames) * frameWidth;
        ctx.drawImage(
            s.img,
            frameX,
            0,
            frameWidth,
            s.sh,
            -s.sw / 2,
            -s.sh / 2,
            s.sw,
            s.sh
        );
    } else {
        ctx.drawImage(
            s.img,
            s.sx,
            s.sy,
            s.sw,
            s.sh,
            -s.sw / 2,
            -s.sh / 2,
            s.sw,
            s.sh
        );
    }
    ctx.restore();
};

const loadImage = (src: string): Promise<HTMLImageElement> =>
    new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.src = src;
    });

const animate = (
    ctx: CanvasRenderingContext2D,
    sprites: Sprite[],
    dt: number
) => {
    sprites.forEach((s) => {
        if (s.fps) {
            s.frame = (s.frame || 0) + dt * s.fps;
        }
    });
    sprites.forEach((s) => drawSprite(ctx, s));
};

const createAnimation = (
    ctx: CanvasRenderingContext2D,
    sprites: Sprite[],
    fps: number
) => {
    let lastTime = 0;
    const render = (time: number) => {
        const dt = (time - lastTime) / 1000;
        lastTime = time;
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        animate(ctx, sprites, dt);
        requestAnimationFrame(render);
    };
    requestAnimationFrame(render);
};

const createScene = async (
    canvas: HTMLCanvasElement,
    sprites: Sprite[],
    fps: number
) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context');
    createAnimation(ctx, sprites, fps);
};

const createCharacter = async (
    imgSrc: string,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    x: number,
    y: number,
    scale?: number,
    frames?: number,
    fps?: number
): Promise<Sprite> => {
    const img = await loadImage(imgSrc);
    return {
        img,
        sx,
        sy,
        sw,
        sh,
        x,
        y,
        scale,
        frames,
        fps,
    };
};