import importlib.util, json, pathlib, sys, types
import pytest

TRANSFERS, MODEL = [], {"out": ""}


class Address(str):
    @property
    def as_hex(self):
        return str(self).lower()


class UserError(Exception):
    pass


class Msg:
    sender_address, value = Address("0x0"), 0


def _install():
    gl = types.ModuleType("genlayer")
    gl.message = Msg
    gl.vm = types.SimpleNamespace(UserError=UserError)
    write = lambda f: f
    write.payable = lambda f: f
    gl.public = types.SimpleNamespace(view=lambda f: f, write=write)
    gl.contract = types.SimpleNamespace(Contract=object)
    gl.storage = types.SimpleNamespace(TreeMap=dict)

    class Wallet:
        def __init__(self, a): self.a = a
        def emit_transfer(self, value): TRANSFERS.append((self.a.as_hex, int(value)))

    gl.evm = types.SimpleNamespace(contract_interface=lambda c: Wallet)
    web = types.SimpleNamespace(render=lambda u, mode="text": "page " + u)
    gl.nondet = types.SimpleNamespace(web=web, exec_prompt=lambda p: MODEL["out"])
    gl.eq_principle = types.SimpleNamespace(strict_eq=lambda f: f())
    t = types.ModuleType("genlayer.types")
    t.Address, t.u256, t.u32 = Address, int, int
    gl.types = t
    sys.modules["genlayer"], sys.modules["genlayer.types"] = gl, t


_install()
spec = importlib.util.spec_from_file_location("keystone", pathlib.Path(__file__).parents[2] / "contracts" / "keystone.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
T, L, X = Address("0xAAA"), Address("0xBBB"), Address("0xCCC")


def call(who, fn, *a, value=0):
    Msg.sender_address, Msg.value = who, value
    return fn(*a)


def fresh():
    TRANSFERS.clear()
    c = mod.Keystone.__new__(mod.Keystone)
    c.deposits = {}
    c.__init__()
    call(T, c.create_deposit, L, "Unit 4B", "Return deposit minus damage beyond normal wear", value=1000)
    return c


def say(conclusive, pct):
    MODEL["out"] = json.dumps({"conclusive": conclusive, "tenant_share_pct": pct})


def state(c):
    return json.loads(c.deposits[0])


def test_tenant_cancels_before_any_evidence():
    c = fresh()
    call(T, c.cancel_deposit, 0)
    assert state(c)["status"] == "cancelled" and TRANSFERS == [(T.as_hex, 1000)] and c.total_locked == 0


def test_ruling_splits_deposit_and_conserves_funds():
    c = fresh()
    call(L, c.submit_evidence, 0, "https://a")
    say(True, 60)
    call(T, c.request_ruling, 0)
    assert state(c)["status"] == "ruled"
    assert sorted(TRANSFERS) == sorted([(T.as_hex, 600), (L.as_hex, 400)]) and c.total_locked == 0


def test_inconclusive_attempt_opens_tenant_refund():
    c = fresh()
    call(T, c.submit_evidence, 0, "https://a")
    say(False, 0)
    call(T, c.request_ruling, 0)
    assert state(c)["status"] == "funded" and state(c)["attempts"] == 1
    for who in (L, X):
        with pytest.raises(UserError):
            call(who, c.claim_refund, 0)
    with pytest.raises(UserError):
        call(T, c.cancel_deposit, 0)
    call(T, c.claim_refund, 0)
    assert state(c)["status"] == "refunded" and TRANSFERS == [(T.as_hex, 1000)] and c.total_locked == 0


def test_second_inconclusive_attempt_refunds_automatically():
    c = fresh()
    call(T, c.submit_evidence, 0, "https://a")
    say(False, 0)
    call(L, c.request_ruling, 0)
    call(L, c.request_ruling, 0)
    assert state(c)["status"] == "refunded" and TRANSFERS == [(T.as_hex, 1000)]


def test_unreadable_output_records_nothing_and_cancel_still_works():
    c = fresh()
    call(T, c.submit_evidence, 0, "https://a")
    MODEL["out"] = "not json"
    with pytest.raises(UserError):
        call(T, c.request_ruling, 0)
    assert state(c)["attempts"] == 0
    call(T, c.cancel_deposit, 0)
    assert state(c)["status"] == "cancelled"


def test_tenant_cannot_cancel_after_landlord_files_evidence():
    c = fresh()
    call(L, c.submit_evidence, 0, "https://claim")
    with pytest.raises(UserError):
        call(T, c.cancel_deposit, 0)
    say(False, 0)
    call(T, c.request_ruling, 0)
    call(T, c.claim_refund, 0)
    assert state(c)["status"] == "refunded"


def test_landlord_can_return_full_deposit():
    c = fresh()
    call(L, c.landlord_release, 0)
    assert state(c)["status"] == "returned" and TRANSFERS == [(T.as_hex, 1000)]


def test_settled_deposit_accepts_no_further_calls():
    c = fresh()
    call(T, c.cancel_deposit, 0)
    n = len(TRANSFERS)
    for who, fn, args in [(T, c.cancel_deposit, (0,)), (T, c.claim_refund, (0,)), (L, c.landlord_release, (0,)),
                          (T, c.submit_evidence, (0, "u")), (T, c.request_ruling, (0,))]:
        with pytest.raises(UserError):
            call(who, fn, *args)
    assert len(TRANSFERS) == n


def test_reduce_verdict():
    r = mod.reduce_verdict
    assert r('{"conclusive": true, "tenant_share_pct": 65}') == "pct:60"
    assert r('{"conclusive": true, "tenant_share_pct": 100}') == "pct:100"
    assert r('{"conclusive": "true", "tenant_share_pct": 50}') == "inconclusive"
    assert r('{"conclusive": true, "tenant_share_pct": true}') == "inconclusive"
    assert r('{"conclusive": true, "tenant_share_pct": 140}') == "inconclusive"
    assert r("garbage") == "invalid"
