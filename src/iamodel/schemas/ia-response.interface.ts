export interface IaResponse {
  message: string;
  type: 'text' 
      | 'cotizaciones_table' 
      | 'products_grid' 
      | 'clients_list' 
      | 'tasks_list'       
      | 'kpi_dashboard'    
      | 'expenses_table';
  data?: any;
}