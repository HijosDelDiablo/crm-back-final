export interface IaResponse {
  message: string;
  type: String
      | 'cotizaciones_table' 
      | 'products_grid' 
      | 'clients_list' 
      | 'tasks_list'       
      | 'kpi_dashboard'    
      | 'expenses_table';
  suggestion?: string;
  metadata?: any;
  data?: any;
}