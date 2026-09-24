import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

// ═══════════════════════════════════════════════════════════════════════════════
// GENERADOR DE PDF — jsPDF + html2canvas
//
// Usar en: Client Components ('use client') unicamente.
// Importar siempre con dynamic() + ssr: false si se usa en una pagina:
//
//   const generarPDF = dynamic(
//     () => import("@/lib/pdf/generador").then(m => m.generarPDF),
//     { ssr: false }
//   )
//
// html2canvas y jsPDF usan APIs del DOM (canvas, Blob) que no existen
// en el entorno Node.js del servidor de Next.js.
// ═══════════════════════════════════════════════════════════════════════════════

// ───────────────────────────────────────────────────────────────────────────────
// TIPOS
// ───────────────────────────────────────────────────────────────────────────────

export interface OpcionesPDF {
    /** Escala de captura del canvas. 2 = 192 DPI — recomendado para documentos de negocio */
    escala?: number
    /** Orientacion del documento PDF */
    orientacion?: "portrait" | "landscape"
    /** Tamano del papel */
    formato?: "a4" | "letter" | "legal"
    /** Margen en mm aplicado dentro del PDF antes de colocar la imagen */
    margen?: number
}

// ───────────────────────────────────────────────────────────────────────────────
// FUNCION PRINCIPAL
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Captura un elemento HTML como imagen y lo exporta como PDF descargable.
 *
 * El elemento puede ser cualquier componente React ya renderizado en el DOM:
 * una tabla de pedido, un resumen de factura, un reporte de inventario.
 * No se necesita reescribir el layout en primitivas especiales.
 *
 * @param elemento  Referencia al elemento HTML a capturar (ref.current)
 * @param nombre    Nombre del archivo PDF sin extension (ej: 'pedido-001')
 * @param opciones  Configuracion opcional — ver OpcionesPDF
 *
 * @example
 * const ref = useRef<HTMLDivElement>(null)
 * await generarPDF(ref.current!, 'pedido-001')
 * await generarPDF(ref.current!, 'reporte', { orientacion: 'landscape', formato: 'letter' })
 */
export async function generarPDF(
    elemento: HTMLElement,
    nombre: string,
    opciones: OpcionesPDF = {}
): Promise<void> {
    const {
        escala = 2,
        orientacion = "portrait",
        formato = "letter",
        margen = 10,
    } = opciones;

    // Paso 1: Capturar el elemento como canvas de alta resolucion
    const canvas = await html2canvas(elemento, {
        scale: escala,              // 2 = 192 DPI — nitido al imprimir o hacer zoom
        useCORS: true,              // Permite capturar imagenes de dominios externos
        logging: false,             // Silenciar logs de debug en produccion
        backgroundColor: "#ffffff", // Fondo blanco explicito — evita fondo transparente
    });

    // Paso 2: Convertir el canvas a imagen PNG
    const imgData = canvas.toDataURL("image/png");

    // Paso 3: Crear el documento PDF con dimensiones del papel
    const pdf = new jsPDF({
        orientation: orientacion,
        unit: "mm",
        format: formato,
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // Area disponible despues de aplicar margenes en los 4 lados
    const areaAncho = pageWidth - margen * 2;
    const areaAlto = pageHeight - margen * 2;

    // Paso 4: Escalar la imagen para que quepa en el area disponible
    const canvasAncho = canvas.width;
    const canvasAlto = canvas.height;
    const relacionAspecto = canvasAncho / canvasAlto;

    let imgAncho = areaAncho;
    let imgAlto = areaAncho / relacionAspecto;

    // Si la imagen excede la altura disponible, ajustar por altura
    if (imgAlto > areaAlto) {
        imgAlto = areaAlto;
        imgAncho = areaAlto * relacionAspecto;
    }

    // Paso 5: Agregar imagen al docPos Y
    pdf.addImage(
        imgData,
        "PNG",
        margen, // Posicion X (margen izquierdo)
        margen, // Posicion Y (margen superior)
        imgAncho,
        imgAlto
    );

    pdf.save(`${nombre}.pdf`);
}

// ───────────────────────────────────────────────────────────────────────────────
// UTILIDAD: MULTIPAGINA
// Para documentos que exceden una pagina de alto.
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Version multipagina de generarPDF.
 * Divide automaticamente el contenido en paginas cuando excede la altura.
 * Usar para reportes largos, listas de productos o estados de cuenta.
 *
 * @param elemento  Referencia al elemento HTML a capturar
 * @param nombre    Nombre del archivo PDF sin extension
 * @param opciones  Configuracion opcional — ver OpcionesPDF
 */
export async function generarPDFMultipagina(
    elemento: HTMLElement,
    nombre: string,
    opciones: OpcionesPDF = {}
): Promise<void> {
    const {
        escala = 2,
        orientacion = "portrait",
        formato = "letter",
        margen = 10,
    } = opciones;

    const canvas = await html2canvas(elemento, {
        scale: escala,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
    });

    const pdf = new jsPDF({
        orientation: orientacion,
        unit: "mm",
        format: formato,
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const areaAncho = pageWidth - margen * 2;
    const areaAlto = pageHeight - margen * 2;

    // Altura de una pagina en pixeles del canvas (para saber cuanto cortar)
    const altosPorPagina = Math.floor((canvas.width / areaAncho) * areaAlto);

    let posicionY = 0;
    let pagina = 0;

    while (posicionY < canvas.height) {
        if (pagina > 0) pdf.addPage();

        // Crear un canvas temporal con el segmento de esta pagina
        const canvasPagina = document.createElement("canvas");
        canvasPagina.width = canvas.width;
        canvasPagina.height = Math.min(altosPorPagina, canvas.height - posicionY);

        const ctx = canvasPagina.getContext("2d")!;
        ctx.drawImage(canvas, 0, -posicionY);

        const imgPagina = canvasPagina.toDataURL("image/png");
        const altoImgMm = (canvasPagina.height / canvas.width) * areaAncho;

        pdf.addImage(imgPagina, "PNG", margen, margen, areaAncho, altoImgMm);

        posicionY += altosPorPagina;
        pagina++;
    }

    pdf.save(`${nombre}.pdf`);
}
