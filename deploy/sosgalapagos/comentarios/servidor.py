"""Comentarios públicos para las páginas de /estudios (sosgalapagos.org).

Servicio mínimo, solo biblioteca estándar: HTTP + SQLite. Caddy lo publica en /estudios/api/*
(quita el prefijo). Los comentarios se publican al instante; se moderan después desde el servidor:

    docker compose exec comentarios python /app/servidor.py listar [pagina]
    docker compose exec comentarios python /app/servidor.py ocultar <id>
    docker compose exec comentarios python /app/servidor.py mostrar <id>

Datos personales (LOPDP): solo el nombre que la persona escriba (opcional) y el texto. La IP no se
guarda: se usa un hash con sal secreta, solo para limitar el envío masivo, y se borra a los 7 días.
"""
import hashlib, json, os, re, secrets, sqlite3, sys, threading, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

DB = os.environ.get("COMENTARIOS_DB", "/datos/comentarios.sqlite")
PAGINAS = set(os.environ.get("COMENTARIOS_PAGINAS", "santa-cruz,san-cristobal,estudios").split(","))
MAX_TEXTO, MAX_NOMBRE = 2000, 60
LIMITES = [(600, 5), (86400, 30)]          # (ventana en s, máximo de comentarios por IP)
_lock = threading.Lock()


def db():
    c = sqlite3.connect(DB, timeout=10)
    c.row_factory = sqlite3.Row
    return c


def iniciar():
    os.makedirs(os.path.dirname(DB), exist_ok=True)
    with db() as c:
        c.execute("""CREATE TABLE IF NOT EXISTS comentarios (
            id INTEGER PRIMARY KEY, pagina TEXT NOT NULL, seccion TEXT NOT NULL DEFAULT '',
            nombre TEXT NOT NULL DEFAULT '', texto TEXT NOT NULL, creado INTEGER NOT NULL,
            visible INTEGER NOT NULL DEFAULT 1, ip_hash TEXT)""")
        c.execute("CREATE INDEX IF NOT EXISTS ix_pag ON comentarios(pagina, visible, creado)")
        c.execute("CREATE TABLE IF NOT EXISTS ajustes (clave TEXT PRIMARY KEY, valor TEXT)")
        if not c.execute("SELECT 1 FROM ajustes WHERE clave='sal'").fetchone():
            c.execute("INSERT INTO ajustes VALUES ('sal', ?)", (secrets.token_hex(32),))


def sal():
    with db() as c:
        return c.execute("SELECT valor FROM ajustes WHERE clave='sal'").fetchone()[0]


def limpiar(t, n):
    t = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", str(t or "")).strip()
    return t[:n]


class H(BaseHTTPRequestHandler):
    server_version = "comentarios"

    def _json(self, code, obj):
        b = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def log_message(self, fmt, *args):      # sin IPs en los registros
        sys.stderr.write("%s %s\n" % (self.command, self.path.split("?")[0]))

    def do_GET(self):
        u = urlparse(self.path)
        if u.path == "/salud":
            return self._json(200, {"ok": True})
        if u.path != "/comentarios":
            return self._json(404, {"error": "no encontrado"})
        pagina = (parse_qs(u.query).get("pagina") or [""])[0]
        if pagina not in PAGINAS:
            return self._json(400, {"error": "página desconocida"})
        with db() as c:
            filas = c.execute("SELECT id, seccion, nombre, texto, creado FROM comentarios "
                              "WHERE pagina=? AND visible=1 ORDER BY creado", (pagina,)).fetchall()
        self._json(200, {"comentarios": [dict(f) for f in filas]})

    def do_POST(self):
        if urlparse(self.path).path != "/comentarios":
            return self._json(404, {"error": "no encontrado"})
        try:
            n = int(self.headers.get("Content-Length", "0"))
            if n > 10000:
                return self._json(413, {"error": "demasiado largo"})
            d = json.loads(self.rfile.read(n) or b"{}")
        except Exception:
            return self._json(400, {"error": "formato inválido"})
        if d.get("web"):                                   # campo trampa para bots
            return self._json(201, {"ok": True})
        pagina = limpiar(d.get("pagina"), 40)
        seccion = re.sub(r"[^a-z0-9-]", "", limpiar(d.get("seccion"), 80).lower())
        nombre = limpiar(d.get("nombre"), MAX_NOMBRE)
        texto = limpiar(d.get("texto"), MAX_TEXTO + 1)
        if pagina not in PAGINAS:
            return self._json(400, {"error": "página desconocida"})
        if len(texto) < 3 or len(texto) > MAX_TEXTO:
            return self._json(400, {"error": f"el comentario debe tener entre 3 y {MAX_TEXTO} caracteres"})
        if len(re.findall(r"https?://|www\.", texto, re.I)) > 2:
            return self._json(400, {"error": "demasiados enlaces"})
        ip = (self.headers.get("Cf-Connecting-Ip") or (self.headers.get("X-Forwarded-For") or "").split(",")[0]
              or self.client_address[0]).strip()
        h = hashlib.sha256((SAL + ip).encode()).hexdigest()
        ahora = int(time.time())
        with _lock, db() as c:
            for ventana, maximo in LIMITES:
                k = c.execute("SELECT COUNT(*) FROM comentarios WHERE ip_hash=? AND creado>?", (h, ahora - ventana)).fetchone()[0]
                if k >= maximo:
                    return self._json(429, {"error": "demasiados comentarios seguidos; prueba más tarde"})
            c.execute("UPDATE comentarios SET ip_hash=NULL WHERE creado<?", (ahora - 7 * 86400,))
            cur = c.execute("INSERT INTO comentarios (pagina, seccion, nombre, texto, creado, ip_hash) VALUES (?,?,?,?,?,?)",
                            (pagina, seccion, nombre, texto, ahora, h))
        self._json(201, {"ok": True, "id": cur.lastrowid})


def cli(args):
    iniciar()
    with db() as c:
        if args[0] == "listar":
            q = "SELECT id, pagina, seccion, nombre, texto, creado, visible FROM comentarios"
            filas = c.execute(q + (" WHERE pagina=?" if len(args) > 1 else "") + " ORDER BY creado", args[1:2]).fetchall()
            for f in filas:
                print(f"#{f['id']} [{'visible' if f['visible'] else 'OCULTO'}] {time.strftime('%Y-%m-%d %H:%M', time.gmtime(f['creado'] - 6 * 3600))} "
                      f"{f['pagina']}/{f['seccion'] or '-'} · {f['nombre'] or 'Anónimo'}: {f['texto'][:200]!r}")
        elif args[0] in ("ocultar", "mostrar") and len(args) == 2:
            c.execute("UPDATE comentarios SET visible=? WHERE id=?", (1 if args[0] == "mostrar" else 0, int(args[1])))
            print("hecho")
        else:
            print(__doc__)


if __name__ == "__main__":
    if len(sys.argv) > 1:
        cli(sys.argv[1:]); sys.exit()
    iniciar()
    SAL = sal()
    puerto = int(os.environ.get("PORT", "8080"))
    print(f"comentarios escuchando en :{puerto}", flush=True)
    ThreadingHTTPServer(("0.0.0.0", puerto), H).serve_forever()
