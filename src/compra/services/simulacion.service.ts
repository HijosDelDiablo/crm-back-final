import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SimulacionService {
  private readonly logger = new Logger(SimulacionService.name);

  async consultarBuroCredito(email: string, nombre: string): Promise<any> {
    this.logger.log(`Simulando consulta a buró de crédito para: ${email}`);
    
    await new Promise(resolve => setTimeout(resolve, 2000));

    const hash = this._generateHash(email);
    const score = 500 + (hash % 500);
    
    const nivelRiesgo = this._determinarNivelRiesgo(score);
    
    return {
      score,
      nivelRiesgo,
      detalles: {
        historialPagos: this._generarHistorialPagos(score),
        cuentasAbiertas: Math.floor((hash % 10) + 1),
        deudasTotales: (hash % 50000) + 5000,
        consultasRecientes: Math.floor((hash % 5)),
        antiguedadCredito: Math.floor((hash % 20) + 1) + ' años'
      },
      fechaConsulta: new Date(),
      exito: true
    };
  }

  async evaluarFinanciamiento(
    datosFinancieros: any,
    resultadoBuro: any,
    montoSolicitado: number,
    plazo: number
  ): Promise<any> {
    this.logger.log('Simulando evaluación de financiamiento bancario');
    
    await new Promise(resolve => setTimeout(resolve, 3000));

    const capacidadPago = datosFinancieros.ingresoMensual + datosFinancieros.otrosIngresos - 
                         datosFinancieros.gastosMensuales - datosFinancieros.deudasActuales;

    const ratioDeuda = (datosFinancieros.deudasActuales + (montoSolicitado / plazo)) / 
                      (datosFinancieros.ingresoMensual + datosFinancieros.otrosIngresos);

    const score = resultadoBuro.score;
    
    const aprobado = score > 600 && capacidadPago > (montoSolicitado / plazo) * 0.4 && ratioDeuda < 0.5;

    if (aprobado) {
      const tasaBase = this._calcularTasaInteres(score, plazo);
      
      return {
        aprobado: true,
        montoAprobado: montoSolicitado,
        tasaInteres: tasaBase,
        plazoAprobado: plazo,
        pagoMensual: this._calcularPagoMensual(montoSolicitado, tasaBase, plazo),
        capacidadPago: capacidadPago,
        ratioDeuda: ratioDeuda,
        fechaAprobacion: new Date(),
        condiciones: [
          'Documentación completa requerida',
          'Seguro obligatorio',
          'Comisión por apertura del 2%'
        ]
      };
    } else {
      return {
        aprobado: false,
        motivoRechazo: this._determinarMotivoRechazo(score, capacidadPago, ratioDeuda),
        capacidadPago: capacidadPago,
        ratioDeuda: ratioDeuda,
        sugerencias: this._generarSugerencias(score, capacidadPago)
      };
    }
  }

  private _generateHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  private _determinarNivelRiesgo(score: number): string {
    if (score >= 800) return 'Excelente';
    if (score >= 700) return 'Bueno';
    if (score >= 600) return 'Regular';
    return 'Alto';
  }

  private _generarHistorialPagos(score: number): any {
    const puntuacion = score / 1000;
    return {
      pagosATiempo: Math.floor(puntuacion * 100) + '%',
      morosidad: puntuacion < 0.7 ? 'Alguna morosidad reportada' : 'Sin morosidad',
      peorAtraso: puntuacion > 0.8 ? 'Ninguno' : '30-60 días'
    };
  }

  private _calcularTasaInteres(score: number, plazo: number): number {
    let tasaBase = 0.15;
    
    if (score >= 800) tasaBase -= 0.05;
    else if (score >= 700) tasaBase -= 0.03;
    else if (score >= 600) tasaBase -= 0.01;
    
    if (plazo > 60) tasaBase += 0.02;
    else if (plazo > 36) tasaBase += 0.01;
    
    return Number(tasaBase.toFixed(3));
  }

  private _calcularPagoMensual(monto: number, tasa: number, plazo: number): number {
    const tasaMensual = tasa / 12;
    const pago = (monto * tasaMensual * Math.pow(1 + tasaMensual, plazo)) / 
                 (Math.pow(1 + tasaMensual, plazo) - 1);
    return Number(pago.toFixed(2));
  }

  private _determinarMotivoRechazo(score: number, capacidadPago: number, ratioDeuda: number): string {
    const motivos: string[] = [];
    
    if (score <= 600) motivos.push('Score crediticio insuficiente');
    if (capacidadPago <= 0) motivos.push('Capacidad de pago insuficiente');
    if (ratioDeuda >= 0.5) motivos.push('Nivel de endeudamiento muy alto');
    
    return motivos.join(', ');
  }

  private _generarSugerencias(score: number, capacidadPago: number): string[] {
    const sugerencias: string[] = [];
    
    if (score < 650) {
      sugerencias.push('Mejore su historial crediticio');
      sugerencias.push('Pague deudas existentes');
    }
    
    if (capacidadPago < 5000) {
      sugerencias.push('Considere un enganche mayor');
      sugerencias.push('Explore opciones de vehículos más económicos');
    }
    
    sugerencias.push('Consulte con un asesor financiero');
    
    return sugerencias;
  }
}