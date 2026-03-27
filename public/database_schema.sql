-- ============================================
-- LABORATORIO CLÍNICO - ESQUEMA DE BASE DE DATOS
-- Sistema BioAnalítica
-- ============================================

-- USUARIOS
CREATE TABLE usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'laboratorist')),
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- CONFIGURACIÓN DEL LABORATORIO
CREATE TABLE configuracion_laboratorio (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    logo TEXT DEFAULT '',
    name VARCHAR(200) NOT NULL,
    owner VARCHAR(200) NOT NULL,
    address TEXT NOT NULL,
    ruc VARCHAR(20) NOT NULL,
    health_registry VARCHAR(50) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    schedule VARCHAR(200) NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- PACIENTES
CREATE TABLE pacientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    cedula VARCHAR(20) UNIQUE NOT NULL,
    phone VARCHAR(30),
    email VARCHAR(100),
    birth_date DATE NOT NULL,
    sex CHAR(1) NOT NULL CHECK (sex IN ('M', 'F')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- REACTIVOS
CREATE TABLE reactivos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    current_stock INTEGER NOT NULL DEFAULT 0,
    min_stock INTEGER NOT NULL DEFAULT 10,
    expiration_date DATE NOT NULL,
    supplier VARCHAR(150) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- MOVIMIENTOS DE INVENTARIO
CREATE TABLE movimientos_inventario (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reagent_id UUID NOT NULL REFERENCES reactivos(id) ON DELETE CASCADE,
    type VARCHAR(10) NOT NULL CHECK (type IN ('entry', 'exit')),
    quantity INTEGER NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- PRUEBAS DE LABORATORIO
CREATE TABLE pruebas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- PARÁMETROS DE PRUEBA
CREATE TABLE parametros_prueba (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID NOT NULL REFERENCES pruebas(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    unit VARCHAR(30) NOT NULL
);

-- RANGOS DE REFERENCIA
CREATE TABLE rangos_referencia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parameter_id UUID NOT NULL REFERENCES parametros_prueba(id) ON DELETE CASCADE,
    sex VARCHAR(5) NOT NULL CHECK (sex IN ('M', 'F', 'both')),
    min_age INTEGER NOT NULL DEFAULT 0,
    max_age INTEGER NOT NULL DEFAULT 120,
    min_value DECIMAL(10, 3) NOT NULL,
    max_value DECIMAL(10, 3) NOT NULL
);

-- RELACIÓN PRUEBAS - REACTIVOS
CREATE TABLE prueba_reactivos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID NOT NULL REFERENCES pruebas(id) ON DELETE CASCADE,
    reagent_id UUID NOT NULL REFERENCES reactivos(id) ON DELETE CASCADE,
    quantity_used DECIMAL(10, 3) NOT NULL DEFAULT 1,
    UNIQUE (test_id, reagent_id)
);

-- ÓRDENES
CREATE TABLE ordenes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(30) UNIQUE NOT NULL,
    access_key VARCHAR(20) NOT NULL,
    patient_id UUID NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
    total DECIMAL(10, 2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- DETALLE DE ORDEN (pruebas asociadas)
CREATE TABLE orden_detalle (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES ordenes(id) ON DELETE CASCADE,
    test_id UUID NOT NULL REFERENCES pruebas(id) ON DELETE CASCADE,
    price DECIMAL(10, 2) NOT NULL,
    UNIQUE (order_id, test_id)
);

-- RESULTADOS
CREATE TABLE resultados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES ordenes(id) ON DELETE CASCADE,
    test_id UUID NOT NULL REFERENCES pruebas(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- DETALLE DE RESULTADOS
CREATE TABLE resultado_detalle (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    result_id UUID NOT NULL REFERENCES resultados(id) ON DELETE CASCADE,
    parameter_id UUID NOT NULL REFERENCES parametros_prueba(id) ON DELETE CASCADE,
    value DECIMAL(10, 3) NOT NULL,
    status VARCHAR(10) NOT NULL CHECK (status IN ('normal', 'high', 'low')),
    applied_range_min DECIMAL(10, 3),
    applied_range_max DECIMAL(10, 3)
);

-- ============================================
-- DATOS DE EJEMPLO
-- ============================================

INSERT INTO configuracion_laboratorio (name, owner, address, ruc, health_registry, phone, schedule)
VALUES ('Laboratorio Clínico BioAnalítica', 'Dra. María Elena Rodríguez', 'Av. República E7-123 y Diego de Almagro, Quito', '1712345678001', 'MSP-LC-2024-0456', '+593 2 2567890', 'Lunes a Viernes 7:00 - 18:00 | Sábado 7:00 - 13:00');

INSERT INTO usuarios (username, password_hash, role, name) VALUES
('admin', '$2b$10$hash_admin123', 'admin', 'Dr. Carlos Mendoza'),
('lab1', '$2b$10$hash_lab123', 'laboratorist', 'Lcda. Ana García');

INSERT INTO pacientes (id, name, cedula, phone, email, birth_date, sex) VALUES
('00000000-0000-0000-0000-000000000001', 'Juan Carlos Pérez', '1712345678', '0991234567', 'juan@email.com', '1990-05-15', 'M'),
('00000000-0000-0000-0000-000000000002', 'María Fernanda López', '1723456789', '0982345678', 'maria@email.com', '1985-08-22', 'F'),
('00000000-0000-0000-0000-000000000003', 'Pedro Antonio Ruiz', '1734567890', '0973456789', 'pedro@email.com', '2015-03-10', 'M'),
('00000000-0000-0000-0000-000000000004', 'Lucía Esperanza Morales', '1745678901', '0964567890', 'lucia@email.com', '1972-11-30', 'F'),
('00000000-0000-0000-0000-000000000005', 'Andrés Felipe Torres', '1756789012', '0955678901', 'andres@email.com', '2000-01-20', 'M');
