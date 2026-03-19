# Smart Parking Analytics System 🚗🅿️

A real-time 2D Smart Parking Management and Analytics System built with Flask, Scikit-learn, and SQLite. This system simulates a multi-floor parking lot, providing predictive insights on slot availability and historical occupancy trends.

---

## 🌟 Key Features

### 🏢 Multi-Floor Visual Simulation
- **Realistic Layout**: 2D asphalt parking grid with a central driveway, aisle arrows, and directed parking rows.
- **Top-Down Car Animations**: Smooth `drive-in` and `drive-out` animations using custom red SVG vehicle models.
- **Real-Time Updates**: Slot status changes (FREE/OCCUPIED) and metrics reflect instantly without page reloads.

### 👥 Persona-Based Roles
- **User Page (`/user`)**: 
  - Focused, streamlined view for drivers.
  - **Live Per-Floor Metrics**: Instant count of Total, Occupied, and Available slots for the current floor.
  - **Interactive Booking**: Click any "FREE" slot to instantly book and park your vehicle.
- **Admin Dashboard (`/admin`)**:
  - Full system control and monitoring overview.
  - **Global Analytics**: Comprehensive view of total occupancy, prediction results, and average rates.
  - **Action Log Feed**: Real-time scrollable feed of all entry/exit events with timestamps.

### 🧠 Analytics & Intelligence
- **Available Prediction**: Uses **Linear Regression** (Scikit-learn) to forecast slot availability for the next 10 minutes.
- **Peak Hour Analysis**: Identifies high-congestion periods based on historical data.
- **Occupancy Trends**: Visualizes hourly usage (Bar chart) and daily occupancy percentages (Line/Area chart).

---

## 🛠️ Tech Stack

- **Backend**: Python 3, Flask (Web Server)
- **Database**: SQLite3 (Session Logging & Slot Management)
- **Data Science**: Scikit-learn (ML), Pandas, NumPy
- **Frontend**: HTML5, Vanilla JS, CSS3 (No Frameworks)
- **Charts**: Chart.js

---

## 🚀 Quick Start

1. **Install Dependencies**:
   ```bash
   pip install flask pandas numpy scikit-learn matplotlib
   ```

2. **Run the Application**:
   ```bash
   python app.py
   ```

3. **Access the Dashboard**:
   - **User View**: `http://127.0.0.1:5000/user`
   - **Admin Dashboard**: `http://127.0.0.1:5000/admin`
   - **Reports**: `http://127.0.0.1:5000/report`

---

## 🏗️ Project Structure

- `app.py`: Main Flask server and API endpoints.
- `database.py`: SQLite schema and data access layer.
- `analytics/`: ML prediction engine and mock data generators.
- `static/`:
  - `css/style.css`: Modern light-theme styling and animations.
  - `js/user.js`: User-specific interaction logic.
  - `js/admin.js`: Admin dashboard and monitoring logic.
  - `js/charts.js`: Chart.js configuration.
- `templates/`: HTML structures for User, Admin, and Report pages.

---

*Made with ❤️ by Vimal*